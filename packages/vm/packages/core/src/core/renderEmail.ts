import _ from 'lodash';

import { Formio, Form } from 'formiojs';
import { evaluate } from '..';

import macros from './deps/nunjucks-macros';

export type RenderEmailOptions = {
  render: any,
  context: any,
}

export async function renderEmail({ render, context = {} }: RenderEmailOptions): Promise<string> {
  if (context._private) {
    delete context._private;
  }
  context.macros = macros;

  const renderMethod = getRenderMethod(render);

  try {
    // TODO: Figure out if premium has to be added to dependencies
    // @ts-ignore
    const premium = await import('@formio/premium/dist/premium-server.min.js');
    Formio.use(premium);
  }
  catch {}
  const form = await (new Form(context.form, {
    server: true,
    noeval: true,
    noDefaults: true
    })).ready;

  const submissionTableHtml = form.getView(context.data, {
    email: true
  });

  const data: any = {
    input: omitUndefined(render),
    submissionTableHtml,
    context,
  };

  const res = await evaluate({
    deps: ['lodash', 'moment', 'core', 'nunjucks'],
    data: data,
    code: getScript(render),
  });
  return res as string;
}

function getScript(data: any) {
  if (_.isString(data)) {
    // Script to render a single string.
    return `
      environment.params = context;
      output = unescape(environment.renderString(sanitize(input), context));
    `;
  }

  // Script to render an object of properties.
  return `
    environment.params = context;
    var rendered = {};
    for (let prop in input) {
      if (input.hasOwnProperty(prop)) {
        rendered[prop] = input[prop];
        if (prop === 'html') {
          rendered[prop] = unescape(environment.renderString(context.macros + sanitize(rendered[prop]), context));
        }
        rendered[prop] = unescape(environment.renderString(context.macros + sanitize(rendered[prop]), context));
      }
    }
    output = rendered;
  `;
};

function getRenderMethod(render: any) {
  let renderMethod = 'static';
  if (process.env.RENDER_METHOD) {
    renderMethod = process.env.RENDER_METHOD;
  }
  else if (render && render.renderingMethod) {
    renderMethod = render.renderingMethod;
  }
  return renderMethod;
}

const omitUndefined = (obj: any) => _.omitBy(obj, _.isUndefined);
