import { createContext, useRef } from 'react';
import { DocumentNode, Kind } from 'graphql';

type AstContextType = {
  astRef: React.MutableRefObject<DocumentNode>;
  updateAst: (newAst: DocumentNode) => void;
};

const initialAst: DocumentNode = {
  kind: Kind.DOCUMENT,
  definitions: [],
};

export const AstContext = createContext<AstContextType>({
  astRef: { current: initialAst },
  updateAst: () => {},
});

type AstContextProviderProps = {
  children: React.ReactNode;
};

export const AstContextProvider = ({ children }: AstContextProviderProps) => {
  // TODO:undefined許容する設計でも良いかも
  const astRef = useRef<DocumentNode>(initialAst);
  const updateAst = (newAst: DocumentNode) => {
    astRef.current = newAst;
  };

  const value = { astRef, updateAst };

  return <AstContext.Provider value={value}>{children}</AstContext.Provider>;
};
