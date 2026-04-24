declare module 'asciichart' {
  export type PlotSeries =
    | readonly number[]
    | readonly (readonly number[])[]

  export type PlotFormatFn = (value: number, index?: number) => string

  export interface PlotOptions {
    offset?: number
    padding?: string
    height?: number
    colors?: readonly (number | string)[]
    min?: number
    max?: number
    format?: PlotFormatFn
  }

  export function plot(series: PlotSeries, options?: PlotOptions): string
}
