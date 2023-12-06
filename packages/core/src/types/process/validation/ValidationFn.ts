import { Component } from "types/Component";
import { DataObject } from "types/DataObject";
import { ComponentInstances } from "../ProcessContext";
import { FieldError } from "error";
export type ValidationFn = (components: Component[], data: DataObject, instances?: ComponentInstances) => Promise<FieldError[]>;
export type ValidationFnSync = (components: Component[], data: DataObject, instances?: ComponentInstances) => FieldError[];