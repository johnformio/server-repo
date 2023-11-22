import Worker from './Worker';

const Tasks: { [key: string]: string } = {
    nunjucks: `./workers/nunjucks.js`,
};

class Local {
    task: string;
    constructor(task: string) {
        this.task = Tasks[task] || '';
    }

    async start(data: any) {
        if (!this.task) {
            return 'Unknown worker';
        }
        return Worker(this.task, data);
    }
}

export default Local;
