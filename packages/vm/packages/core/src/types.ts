export type Form = {
    components: any[];
    module?: string;
};

export type Submission = {
    metadata?: any;
    data: any;
};

export type ValidationError = {
    name: 'ValidationError';
    details: any[];
};

export type ValidationCallback = (
    error: ValidationError | null,
    submissionData?: Submission['data'],
    visibleComponents?: any[]
) => void;
