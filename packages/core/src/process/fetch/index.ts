import {
  ProcessorFn,
  ProcessorInfo,
  FetchContext,
  FetchScope,
  FetchFn,
  DataSourceComponent,
  FilterContext,
} from 'types';
import { get, set } from 'lodash';
import { Evaluator } from 'utils';
import { getComponentKey } from 'utils/formUtil';

export const shouldFetch = (context: FetchContext): boolean => {
  const { component, config } = context;
  if (
    component.type !== 'datasource' ||
    (config?.server && !get(component, 'trigger.server', false))
  ) {
    return false;
  }
  return true;
};

export const fetchProcess: ProcessorFn<FetchScope> = async (context: FetchContext) => {
  const { component, row, evalContext, path, scope, config } = context;
  let _fetch: FetchFn | null = null;
  try {
    _fetch = context.fetch ? context.fetch : fetch;
  } catch (ignoreErr) {
    _fetch = null;
  }
  if (!_fetch) {
    console.log('You must provide a fetch interface to the fetch processor.');
    return;
  }
  if (!shouldFetch(context)) {
    return;
  }
  if (!scope.fetched) scope.fetched = {};
  const evalContextValue = evalContext ? evalContext(context) : context;
  const url = Evaluator.interpolateString(get(component, 'fetch.url', ''), evalContextValue);
  if (!url) {
    return;
  }
  const request: any = {
    method: get(component, 'fetch.method', 'get').toUpperCase(),
    headers: {},
  };

  if (
    config?.headers &&
    (component as DataSourceComponent)?.fetch &&
    (component as DataSourceComponent)?.fetch?.forwardHeaders
  ) {
    request.headers = JSON.parse(JSON.stringify(config.headers));
    delete request.headers['host'];
    delete request.headers['content-length'];
    delete request.headers['content-type'];
    delete request.headers['connection'];
    delete request.headers['cache-control'];
  }

  request.headers['Accept'] = '*/*';
  request.headers['user-agent'] = 'Form.io DataSource Component';
  get(component, 'fetch.headers', []).map((header: any) => {
    header.value = Evaluator.interpolateString(header.value, evalContextValue);
    if (header.value && header.key) {
      request.headers[header.key] = header.value;
    }
    return header;
  });

  if (get(component, 'fetch.authenticate', false) && config?.tokens) {
    Object.assign(request.headers, config.tokens);
  }

  const body = get(component, 'fetch.specifyBody', '');
  if (request.method === 'POST') {
    request.body = JSON.stringify(Evaluator.evaluate(body, evalContextValue, 'body'));
  }

  try {
    // Perform the fetch.
    const result = await (await _fetch(url, request)).json();
    const mapFunction = get(component, 'fetch.mapFunction');

    // Set the row data of the fetched value.
    const key = getComponentKey(component);
    set(
      row,
      key,
      mapFunction
        ? Evaluator.evaluate(
            mapFunction,
            {
              ...evalContextValue,
              ...{ responseData: result },
            },
            'value',
          )
        : result,
    );

    // Make sure the value does not get filtered for now...
    if (!(scope as FilterContext).filter) (scope as FilterContext).filter = {};
    (scope as FilterContext).filter[path] = true;
    scope.fetched[path] = true;
  } catch (err: any) {
    console.log(err.message);
  }
};

export const fetchProcessInfo: ProcessorInfo<FetchContext, void> = {
  name: 'fetch',
  process: fetchProcess,
  shouldProcess: shouldFetch,
};
