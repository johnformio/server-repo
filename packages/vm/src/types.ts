export interface JSON {
    [key: string]: string | boolean | number | undefined | JSON | JSON[];
}

export type Form = {
    components: JSON[];
    module?: string | { options?: { form?: { evalContext?: any } } };
};

export type Submission = {
    data: JSON;
    metadata?: JSON;
};

export type TemplateData = {
    render: {
        from: string;
        to: string;
        subject: string;
        html: string;
        msgTransport: string;
        transport: string;
        renderingMethod: 'dynamic' | 'static';
    };
    context: {
        data: JSON;
        owner: JSON;
        access: JSON;
        metadata: JSON;
        _vnote: string;
        state: 'submitted' | 'draft';
        form: Form;
        project: '65300e36b48b095cc5402a52';
        _fvid: 0;
        components: Form['components'];
        componentsWithPath: JSON;
        config: JSON;
        content: string;
        settings: {
            transport: string;
            from: string;
            replyTo: string;
            emails: string[];
            sendEach: boolean;
            cc: string[];
            bcc: string[];
            subject: string;
            template: string;
            message: string;
            renderingMethod: 'dynamic' | 'static';
            attachFiles: boolean;
            attachPDF: boolean;
        };
        mail: TemplateData['render'];
        _private?: unknown;
    };
};

export type TemplateFn = (
    data: TemplateData
) => Promise<TemplateData['render']>;
