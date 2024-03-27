import { ValidationRuleInfo } from "types";
import { validateUniqueInfo } from "./validateUnique";
import { validateCaptchaInfo } from "./validateCaptcha";
import { validateNumberInfo } from "./validateNumber";

// These are the validations that require a database connection.
export const databaseRules: ValidationRuleInfo[] = [
    validateUniqueInfo,
    validateCaptchaInfo,
    validateNumberInfo
];
