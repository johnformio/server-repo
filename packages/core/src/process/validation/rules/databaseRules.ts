import { ValidationRuleInfo } from "types";
import { validateUniqueInfo } from "./validateUnique";

// These are the validations that require a database connection.
// TODO: add recaptcha
export const databaseRules: ValidationRuleInfo[] = [
    validateUniqueInfo,
];
