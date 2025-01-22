import { instanceShimCode } from './InstanceShim';
import { lodashCode } from './deps/lodash';
import { momentCode } from './deps/moment';
import { inputmaskCode } from './deps/inputmask';
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
    inputmask: [inputmaskCode],
    core: [polyfillCode, coreCode, fastJsonPatchCode, aliasesCode],
    instanceShim: [instanceShimCode],
    nunjucks: [
        nunjucksCode,
        nunjucksDateFilterCode,
        nunjucksEnvironmentCode,
        nunjucksUtilsCode,
    ],
};

export let globalTimeout = 500;

type BaseDependencyMap = {
    lodash?: string;
    moment?: string;
    inputmask?: string;
    core?: string;
    instanceShim?: string;
    nunjucks?: string;
    nunjucksDateFilter?: string;
};

type VmOptions = {
    dependencies: BaseDependencyMap;
    timeout?: number;
};

/**
 * Function to modify/configure the formio/vm library's global dependencies map.
 */
export const configureVm = ({
    dependencies: {
        lodash,
        moment,
        inputmask,
        core,
        instanceShim,
        nunjucks,
        nunjucksDateFilter,
    },
    timeout,
}: VmOptions) => {
    if (lodash) {
        dependeciesMap.lodash = [lodash];
    }
    if (moment) {
        dependeciesMap.moment = [moment];
    }

    if (inputmask) {
        dependeciesMap.inputmask = [inputmask];
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

    if (timeout) {
        globalTimeout = timeout;
    }
};
