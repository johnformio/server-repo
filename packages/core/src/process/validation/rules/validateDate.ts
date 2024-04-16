import { FieldError } from 'error';
import { DateTimeComponent, TextFieldComponent, RuleFn, RuleFnSync, ValidationContext } from 'types';
import { ProcessorInfo } from 'types/process/ProcessorInfo';

const isValidatableDateTimeComponent = (obj: any): obj is DateTimeComponent => {
    return !!obj && !!obj.type && obj.type === 'datetime';
};

const isValidatableTextFieldComponent = (obj: any): obj is TextFieldComponent => {
    return !!obj && !!obj.type && obj.widget && obj.widget.type === 'calendar';
};

const isValidatable = (component: any) => {
    return isValidatableDateTimeComponent(component) || isValidatableTextFieldComponent(component);
};

export const shouldValidate = (context: ValidationContext) => {
    const { component, value} = context;
    if (!value || !isValidatable(component)) {
        return false;
    }
    return true;
};

export const validateDate: RuleFn = async (context: ValidationContext) => {
    return validateDateSync(context);
};

export const validateDateSync: RuleFnSync = (context: ValidationContext) => {
    const error = new FieldError('invalidDate', context, 'date');
    const { component, value} = context;
    if (!shouldValidate(context)) {
        return null;
    }

    // TODO: is this right?
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'invalid date') {
            return error;
        }
        if (new Date(value).toString() === 'Invalid Date') {
            return error;
        }
        return null;
    } else if (value instanceof Date) {
        return value.toString() !== 'Invalid Date' ? null : error;
    }
    return error;
};

export const validateDateInfo: ProcessorInfo<ValidationContext, FieldError | null> = {
    name: 'validateDate',
    process: validateDate,
    processSync: validateDateSync,
    shouldProcess: shouldValidate
};
