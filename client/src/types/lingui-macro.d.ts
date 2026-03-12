/**
 * Type override for @lingui/macro JSX components.
 *
 * @lingui/react/macro declares Trans, Plural, Select, SelectOrdinal as
 * returning ReactNode, but the JSX type checker in TypeScript < 5.1 requires
 * JSX elements to return ReactElement | null (not the broader ReactNode).
 *
 * TypeScript 5.1+ relaxes this via the new JSX.ElementType inference, but this
 * project uses TypeScript 4.7.3, so we need the narrower return type.
 *
 * At runtime the babel plugin transforms these macros into @lingui/react's Trans
 * component which correctly returns ReactElement | null, so this narrowing is safe.
 *
 * This file can be removed when the project upgrades to TypeScript 5.1+.
 */
import type { ReactElement, ReactNode, ComponentType } from 'react';
import type { I18n } from '@lingui/core';
import type { MacroMessageDescriptor } from '@lingui/core/macro';

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
