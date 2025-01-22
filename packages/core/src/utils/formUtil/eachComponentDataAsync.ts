import { get } from 'lodash';

import {
  Component,
  DataObject,
  EachComponentDataAsyncCallback,
  HasColumns,
  HasRows,
  ComponentPaths,
  HasChildComponents,
} from 'types';
import {
  isComponentNestedDataType,
  componentInfo,
  getContextualRowData,
  shouldProcessComponent,
  resetComponentScope,
  getModelType,
} from './index';
import { eachComponentAsync } from './eachComponentAsync';

// Async each component data.
export const eachComponentDataAsync = async (
  components: Component[],
  data: DataObject,
  fn: EachComponentDataAsyncCallback,
  includeAll: boolean = false,
  local: boolean = false,
  parent?: Component,
  parentPaths?: ComponentPaths,
) => {
  if (!components) {
    return;
  }
  return await eachComponentAsync(
    components,
    async (
      component: Component,
      compPath: string,
      componentComponents: Component[] | undefined,
      compParent: Component | undefined,
      compPaths: ComponentPaths | undefined,
    ) => {
      const row = getContextualRowData(component, data, compPaths, local);
      if (
        (await fn(
          component,
          data,
          row,
          compPaths?.dataPath || '',
          componentComponents,
          compPaths?.dataIndex,
          compParent,
        )) === true
      ) {
        resetComponentScope(component);
        return true;
      }
      if (isComponentNestedDataType(component)) {
        const value = get(data, local ? compPaths?.localDataPath || '' : compPaths?.dataPath || '');
        if (
          getModelType(component) === 'nestedArray' ||
          getModelType(component) === 'nestedDataArray'
        ) {
          if (Array.isArray(value) && value.length) {
            for (let i = 0; i < value.length; i++) {
              if (compPaths) {
                compPaths.dataIndex = i;
              }
              await eachComponentDataAsync(
                component.components,
                data,
                fn,
                includeAll,
                local,
                component,
                compPaths,
              );
            }
          } else if (includeAll) {
            await eachComponentDataAsync(
              component.components,
              data,
              fn,
              includeAll,
              local,
              component,
              compPaths,
            );
          }
          resetComponentScope(component);
          return true;
        } else {
          if (!includeAll && !shouldProcessComponent(component, row, value)) {
            resetComponentScope(component);
            return true;
          }
          await eachComponentDataAsync(
            component.components,
            data,
            fn,
            includeAll,
            local,
            component,
            compPaths,
          );
        }
        resetComponentScope(component);
        return true;
      } else if (!component.type || getModelType(component) === 'none') {
        const info = componentInfo(component);
        if (info.hasColumns) {
          const columnsComponent = component as HasColumns;
          for (const column of columnsComponent.columns) {
            await eachComponentDataAsync(
              column.components,
              data,
              fn,
              includeAll,
              local,
              component,
              compPaths,
            );
          }
        } else if (info.hasRows) {
          const rowsComponent = component as HasRows;
          for (const rowArray of rowsComponent.rows) {
            if (Array.isArray(rowArray)) {
              for (const row of rowArray) {
                await eachComponentDataAsync(
                  row.components,
                  data,
                  fn,
                  includeAll,
                  local,
                  component,
                  compPaths,
                );
              }
            }
          }
        } else if (info.hasComps) {
          await eachComponentDataAsync(
            (component as HasChildComponents).components,
            data,
            fn,
            includeAll,
            local,
            component,
            compPaths,
          );
        }
        resetComponentScope(component);
        return true;
      }
      resetComponentScope(component);
      return false;
    },
    true,
    parentPaths,
    parent,
  );
};
