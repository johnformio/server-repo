import { isBoolean, isString } from 'lodash';
import { BaseComponent, Component } from 'types';

/**
 * Escapes RegEx characters in provided String value.
 *
 * @param {String} value
 *   String for escaping RegEx characters.
 * @returns {string}
 *   String with escaped RegEx characters.
 */
export function escapeRegExCharacters(value: string) {
  return value.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

/**
 * Determines the boolean value of a setting.
 *
 * @param value
 * @return {boolean}
 */
export function boolValue(value: any) {
  if (isBoolean(value)) {
    return value;
  } else if (isString(value)) {
    return value.toLowerCase() === 'true';
  } else {
    return !!value;
  }
}

/**
 * Unescape HTML characters like &lt, &gt, &amp and etc.
 * @param str
 * @returns {string}
 */
export function unescapeHTML(str: string) {
  if (typeof window === 'undefined' || !('DOMParser' in window)) {
    return str;
  }

  const doc = new window.DOMParser().parseFromString(str, 'text/html');
  return doc.documentElement.textContent;
}

export function registerEphemeralState(
  component: Component,
  name: keyof NonNullable<BaseComponent['ephemeralState']>,
  value: any,
) {
  if (!component.ephemeralState) {
    Object.defineProperty(component, 'ephemeralState', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: {},
    });
  }
  Object.defineProperty(component.ephemeralState, name, {
    enumerable: false,
    writable: false,
    configurable: true,
    value,
  });
}

export function resetEphemeralState(component: Component) {
  if (component.ephemeralState) {
    delete component.ephemeralState;
  }
}
