import fs from 'fs';
import path from 'path';

export const nunjucksCode = fs.readFileSync(
    path.join(__dirname, './assets/nunjucks.min.js'),
    'utf8',
);
export const nunjucksDateFilterCode = fs.readFileSync(
    path.join(__dirname, './assets/nunjucks-date-filter.js'),
    'utf8',
);

// Strip away macros and escape breakout attempts.
const sanitize = (input: any) => {
    if (!input) {
        throw new Error('Input is required for sanitize fn');
    }
    return input.replace(
        /{{(.*(\.constructor|\]\().*)}}/g,
        '{% raw %}{{$1}}{% endraw %}',
    );
};

// Unescape HTML sequences
const unescape = (str: any) => {
    if (!str) {
        throw new Error('Input is required for unescape fn');
    }
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
};

export const nunjucksEnvironmentCode = `
// Configure nunjucks to not watch any files
const environment = nunjucks.configure([], {
  watch: false,
  autoescape: false,
});

environment.addFilter('is_string', (obj) => _.isString(obj));

environment.addFilter('is_array', (obj) => _.isArray(obj));

environment.addFilter('is_object', (obj) => _.isPlainObject(obj));

environment.addFilter('date', dateFilter);

environment.addFilter('submissionTable', (obj, components, formInstance) => {
  const view = submissionTableHtml ?? util.renderFormSubmission(obj, components);
  return new nunjucks.runtime.SafeString(view);
});

environment.addFilter('componentValue', (obj, key, components) => {
  const compValue = util.renderComponentValue(obj, key, components);
  return new nunjucks.runtime.SafeString(compValue.value);
});

environment.addFilter('componentLabel', (key, components) => {
  if (!components.hasOwnProperty(key)) {
    return key;
  }

  const component = components[key];
  return component.label || component.placeholder || component.key;
});

sanitize = ${sanitize.toString()};
unescape = ${unescape.toString()};
`;
