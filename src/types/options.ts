export interface Option {
    id: string;
    value: string;
}

export interface Options {
    [id: string]: Option[];
}
