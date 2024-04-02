import { instanceShimCode } from './InstanceShim';
import { lodashCode } from './deps/lodash';
import { momentCode } from './deps/moment';
import {
    polyfillCode,
    aliasesCode,
    coreCode,
    fastJsonPatchCode,
} from './deps/core';
import {
    nunjucksCode,
    nunjucksDateFilterCode,
    nunjucksEnvironmentCode,
} from './deps/nunjucks';
import { nunjucksUtilsCode } from './deps/nunjucks-utils';

// Dependency name corresponds to list of libraries to load when that dependency is requested
export const dependeciesMap = {
    lodash: [lodashCode],
    moment: [momentCode],
    core: [polyfillCode, coreCode, fastJsonPatchCode, aliasesCode],
    instanceShim: [instanceShimCode],
    nunjucks: [
        nunjucksCode,
        nunjucksDateFilterCode,
        nunjucksEnvironmentCode,
        nunjucksUtilsCode,
    ],
};

type BaseDependencyMap = {
    lodash?: string;
    moment?: string;
    core?: string;
    instanceShim?: string;
    nunjucks?: string;
    nunjucksDateFilter?: string;
};

/**
 * Function to modify/configure the formio/vm library's global dependencies map.
 */
export const configure = ({
    lodash,
    moment,
    core,
    instanceShim,
    nunjucks,
    nunjucksDateFilter,
}: BaseDependencyMap) => {
    if (lodash) {
        dependeciesMap.lodash = [lodash];
    }
    if (moment) {
        dependeciesMap.moment = [moment];
    }
    if (core) {
        dependeciesMap.core = [
            polyfillCode,
            core,
            fastJsonPatchCode,
            aliasesCode,
        ];
    }
    if (instanceShim) {
        dependeciesMap.instanceShim = [instanceShim];
    }
    if (nunjucks) {
        if (nunjucksDateFilter) {
            dependeciesMap.nunjucks = [
                nunjucks,
                nunjucksDateFilter,
                nunjucksEnvironmentCode,
                nunjucksUtilsCode,
            ];
        } else {
            dependeciesMap.nunjucks = [
                nunjucks,
                nunjucksDateFilterCode,
                nunjucksEnvironmentCode,
                nunjucksUtilsCode,
            ];
        }
    }
};
