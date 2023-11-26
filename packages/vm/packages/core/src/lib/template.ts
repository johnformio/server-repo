import { TemplateData } from '../types';
import {
    template as _template,
    instantiateTemplateWorker,
} from '../core/Templator';

export async function template(
    data: TemplateData,
    multiThreaded: boolean = true
) {
    return multiThreaded ? instantiateTemplateWorker(data) : _template(data);
}
