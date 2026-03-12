/**
 * Type augmentation for @lingui/macro and @lingui/react/macro to fix React 17 compatibility.
 *
 * Lingui v5 declares Trans/Plural/Select/SelectOrdinal as returning ReactNode,
 * but React 17's JSX type system requires ReactElement | null for JSX components.
 * This override narrows the return type until the project upgrades to React 19 (US-008).
 */
import type { ReactElement, ReactNode } from 'react';
import type { TransRenderCallbackOrComponent } from '@lingui/react';

type LinguiCommonProps = TransRenderCallbackOrComponent & {
  id?: string;
  comment?: string;
  context?: string;
};

type LinguiTransChildren = ReactNode;
type LinguiTransProps = {
  children: LinguiTransChildren | LinguiTransChildren[];
} & LinguiCommonProps;

type LinguiPluralChoiceProps = {
  value: string | number;
  offset?: number;
  zero?: ReactNode;
  one?: ReactNode;
  two?: ReactNode;
  few?: ReactNode;
  many?: ReactNode;
  other: ReactNode;
  [digit: `_${number}`]: ReactNode;
} & LinguiCommonProps;

type LinguiSelectChoiceProps = {
  value: string;
  other: ReactNode;
  [option: `_${string}`]: ReactNode;
} & LinguiCommonProps;

declare module '@lingui/react/macro' {
  export const Trans: (props: LinguiTransProps) => ReactElement | null;
  export const Plural: (props: LinguiPluralChoiceProps) => ReactElement | null;
  export const Select: (props: LinguiSelectChoiceProps) => ReactElement | null;
  export const SelectOrdinal: (props: LinguiPluralChoiceProps) => ReactElement | null;
}

declare module '@lingui/macro' {
  export const Trans: (props: LinguiTransProps) => ReactElement | null;
  export const Plural: (props: LinguiPluralChoiceProps) => ReactElement | null;
  export const Select: (props: LinguiSelectChoiceProps) => ReactElement | null;
  export const SelectOrdinal: (props: LinguiPluralChoiceProps) => ReactElement | null;
}
