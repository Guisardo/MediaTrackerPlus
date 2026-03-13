import React, { FunctionComponent } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export const CheckboxWithTitleAndDescription: FunctionComponent<{
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = (props) => {
  const { title, description, checked, onChange } = props;

  return (
    <div>
      {description && (
        <div className="font-light text-zinc-600 dark:text-zinc-400">
          {description}
        </div>
      )}
      <div className="flex items-center space-x-2 pb-2">
        <Checkbox
          checked={checked}
          onCheckedChange={onChange}
          id={`checkbox-${title.replace(/\s+/g, '-').toLowerCase()}`}
        />
        <label htmlFor={`checkbox-${title.replace(/\s+/g, '-').toLowerCase()}`} className="cursor-pointer select-none text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {title}
        </label>
      </div>
    </div>
  );
};
