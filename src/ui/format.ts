// Shows numbers as the report prints them. A missing figure is a dash, never a zero.

export const NOT_STATED = '–';

export function num(n: number | null | undefined): string {
  return n === null || n === undefined ? NOT_STATED : String(n);
}

export function kg(n: number | null | undefined): string {
  return n === null || n === undefined ? NOT_STATED : `${n} kg`;
}

export function metres(n: number | null | undefined): string {
  return n === null || n === undefined ? NOT_STATED : `${n} m`;
}

export function degrees(n: number | null | undefined): string {
  return n === null || n === undefined ? NOT_STATED : `${n}°`;
}
