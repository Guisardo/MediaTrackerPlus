import { FunctionComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';

export const Portal: FunctionComponent<{ children: ReactNode }> = (props) => {
  return ReactDOM.createPortal(
    props.children,
    document.querySelector('#portal')
  );
};
