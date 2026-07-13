/**
 * @module questionsBankReducers
 *
 * Reducers for the QuestionsBankCreate form — one per question type (normal, MCQ, project task).
 * Each reducer manages its own slice of form state with granular per-field actions
 * and a bulk RESET action used when populating fields in edit mode.
 */
import type { SubTaskItem } from "@/types/taskPaper";

export interface QuestionState {
    text: string;
    marks: number | "";
    hours: number | "";
    minutes: number | "";
}

export type QuestionAction =
    | { type: "SET_TEXT"; payload: string }
    | { type: "SET_MARKS"; payload: number | "" }
    | { type: "SET_HOURS"; payload: number | "" }
    | { type: "SET_MINUTES"; payload: number | "" }
    | { type: "RESET"; payload: QuestionState };

export const questionInitialState: QuestionState = {
    text: "",
    marks: "",
    hours: "",
    minutes: "",
};

export function questionReducer(state: QuestionState, action: QuestionAction): QuestionState {
    switch (action.type) {
        case "SET_TEXT":
            return { ...state, text: action.payload };
        case "SET_MARKS":
            return { ...state, marks: action.payload };
        case "SET_HOURS":
            return { ...state, hours: action.payload };
        case "SET_MINUTES":
            return { ...state, minutes: action.payload };
        case "RESET":
            return { ...action.payload };
        default:
            return state;
    }
}



export interface MCQState {
    question: string;
    options: string[];
    answer: string;
    marks: number | "";
    hours: number | "";
    minutes: number | "";
}

export type MCQAction =
    | { type: "SET_QUESTION"; payload: string }
    | { type: "SET_OPTIONS"; payload: string[] }
    | { type: "SET_ANSWER"; payload: string }
    | { type: "SET_MARKS"; payload: number | "" }
    | { type: "SET_HOURS"; payload: number | "" }
    | { type: "SET_MINUTES"; payload: number | "" }
    | { type: "RESET"; payload: MCQState };

export const mcqInitialState: MCQState = {
    question: "",
    options: ["", ""],
    answer: "",
    marks: "",
    hours: "",
    minutes: "",
};

export function mcqReducer(state: MCQState, action: MCQAction): MCQState {
    switch (action.type) {
        case "SET_QUESTION":
            return { ...state, question: action.payload };
        case "SET_OPTIONS":
            return { ...state, options: action.payload };
        case "SET_ANSWER":
            return { ...state, answer: action.payload };
        case "SET_MARKS":
            return { ...state, marks: action.payload };
        case "SET_HOURS":
            return { ...state, hours: action.payload };
        case "SET_MINUTES":
            return { ...state, minutes: action.payload };
        case "RESET":
            return { ...action.payload };
        default:
            return state;
    }
}


export interface ProjectTaskState {
    description: string;
    instructions: string;
    hours: number | "";
    minutes: number | "";
    tasks: SubTaskItem[];
}


export type ProjectTaskAction =
    | { type: "SET_DESCRIPTION"; payload: string }
    | { type: "SET_INSTRUCTIONS"; payload: string }
    | { type: "SET_HOURS"; payload: number | "" }
    | { type: "SET_MINUTES"; payload: number | "" }
    | { type: "SET_TASKS"; payload: SubTaskItem[] }
    | { type: "RESET"; payload: ProjectTaskState };

export const projectTaskInitialState: ProjectTaskState = {
    description: "",
    instructions: "",
    hours: "",
    minutes: "",
    tasks: [],
};

export function projectTaskReducer(
    state: ProjectTaskState,
    action: ProjectTaskAction
): ProjectTaskState {
    switch (action.type) {
        case "SET_DESCRIPTION":
            return { ...state, description: action.payload };
        case "SET_INSTRUCTIONS":
            return { ...state, instructions: action.payload };
        case "SET_HOURS":
            return { ...state, hours: action.payload };
        case "SET_MINUTES":
            return { ...state, minutes: action.payload };
        case "SET_TASKS":
            return { ...state, tasks: action.payload };
        case "RESET":
            return { ...action.payload };
        default:
            return state;
    }
}
