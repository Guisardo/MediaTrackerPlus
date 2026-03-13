import React, { FunctionComponent } from 'react';

export const SettingsSegment: FunctionComponent<{
  title: string;
  href?: string;
  children?: React.ReactNode;
}> = (props) => {
  const { title, href, children } = props;

  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
      {href ? (
        <a className="mb-2 text-lg font-semibold underline block" href={href}>
          {title}
        </a>
      ) : (
        <div className="mb-2 text-lg font-semibold">{title}</div>
      )}

      <div>{children}</div>
    </div>
  );
};
