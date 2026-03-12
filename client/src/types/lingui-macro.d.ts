/**
 * Type override for @lingui/macro to fix React 17 JSX compatibility.
 *
 * Lingui v5 macros (Trans, Plural, Select, SelectOrdinal) are declared as returning
 * ReactNode, but React 17's JSX system requires ReactElement | null.
 *
 * At runtime, the babel plugin transforms these macros into @lingui/react's Trans
 * component which correctly returns ReactElement | null. So this type narrowing
 * is safe — it aligns the static types with the actual runtime behavior.
 *
 * This file will be removed when the project upgrades to React 19 (US-008),
 * where ReactNode is a valid JSX return type.
 */
import type { ReactElement, ReactNode, ComponentType } from 'react';
import type { I18n, MessageOptions } from '@lingui/core';

type TransRenderProps = {
  id: string;
  translation: ReactNode;
  children: ReactNode;
  message?: string | null;
};

type TransRenderCallbackOrComponent =
  | {
      component?: never;
      render?: ((props: TransRenderProps) => ReactElement<any, any>) | null;
    }
  | {
      component?: ComponentType<TransRenderProps> | null;
      render?: never;
    };

type CommonProps = TransRenderCallbackOrComponent & {
  id?: string;
  comment?: string;
  context?: string;
};

type TransProps = {
  children: ReactNode | ReactNode[];
} & CommonProps;

type PluralChoiceProps = {
  value: string | number;
  offset?: number;
  zero?: ReactNode;
  one?: ReactNode;
  two?: ReactNode;
  few?: ReactNode;
  many?: ReactNode;
  other: ReactNode;
  [digit: `_${number}`]: ReactNode;
} & CommonProps;

type SelectChoiceProps = {
  value: string;
  other: ReactNode;
  [option: `_${string}`]: ReactNode;
} & CommonProps;

interface MacroMessageDescriptor {
  id?: string;
  comment?: string;
  context?: string;
  message?: string;
}

export declare function t(descriptor: MacroMessageDescriptor): string;
export declare function t(
  literals: TemplateStringsArray,
  ...placeholders: any[]
): string;

export declare function msg(descriptor: MacroMessageDescriptor): MacroMessageDescriptor;
export declare function msg(
  literals: TemplateStringsArray,
  ...placeholders: any[]
): MacroMessageDescriptor;

export declare function plural(
  value: number | string,
  options: Record<string, string>
): string;

export declare function defineMessage(descriptor: MacroMessageDescriptor): MacroMessageDescriptor;

export declare function select(
  value: string,
  options: Record<string, string>
): string;

export declare function selectOrdinal(
  value: number | string,
  options: Record<string, string>
): string;

export declare const Trans: (props: TransProps) => ReactElement | null;
export declare const Plural: (props: PluralChoiceProps) => ReactElement | null;
export declare const Select: (props: SelectChoiceProps) => ReactElement | null;
export declare const SelectOrdinal: (props: PluralChoiceProps) => ReactElement | null;

export declare function useLingui(): {
  i18n: I18n;
  defaultComponent?: ComponentType<TransRenderProps>;
  t: typeof t;
};

export type {
  TransProps,
  PluralChoiceProps as ChoiceOptions,
  SelectChoiceProps as SelectOptions,
  MacroMessageDescriptor,
  CommonProps,
};
