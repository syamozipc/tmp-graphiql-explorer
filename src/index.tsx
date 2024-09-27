import { AstContextProvider } from './contexts/AstContextProvider';
import Controller from './components/Controller';

const Explorer = () => {
  return (
    <AstContextProvider>
      <Controller />
    </AstContextProvider>
  );
};

export default Explorer;
