export type NotebookCell = {
  cell_type?: string
  source?: string | string[]
  [key: string]: unknown
}

export type Notebook = {
  cells?: NotebookCell[]
  [key: string]: unknown
}
