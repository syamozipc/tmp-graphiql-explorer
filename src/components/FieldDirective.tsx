import { useContext, useState } from 'react';
import { Checkbox } from '@chakra-ui/react';
import { GraphQLDirective, GraphQLField, print, DirectiveNode } from 'graphql';
import { useEditorContext } from '@graphiql/react';
import { AstContext } from '../contexts/AstContextProvider';
import { generateNewAST } from '../helpers/ast';
import { COLORS, UPDATE_TYPES } from '../helpers/const';

type FieldDirectiveProps = {
  directive: GraphQLDirective;
  field: GraphQLField<any, any>;
  fieldDirectives: GraphQLDirective[];
  ancestorFieldNames: string[];
  defaultAstDirective: DirectiveNode | undefined;
};

function FieldDirective(props: FieldDirectiveProps) {
  const editorContext = useEditorContext({ nonNull: true });
  const astContext = useContext(AstContext);
  const currentAst = astContext.astRef.current;

  // TODO: editorの値がvariableだったらtrueで初期化の処理が必要
  const [isVariable, setIsVariable] = useState(false);
  const [isChecked, setIsChecked] = useState(!!props.defaultAstDirective);

  // ディレクティブのチェックボックスが変更されたらeditorに反映
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedAST = generateNewAST({
      type: UPDATE_TYPES.DIRECTIVE,
      ast: currentAst,
      field: props.field,
      ancestorFieldNames: props.ancestorFieldNames,
      shouldAdd: e.target.checked,
      fieldDirectives: props.fieldDirectives,
      directiveName: e.target.value,
    });

    astContext.updateAst(updatedAST);
    editorContext.queryEditor?.setValue(print(updatedAST));
    setIsChecked(true);
  };

  const onClickDirective = (directiveName: string) => {
    // TODO: 変数とリテラルをtoggleしたい
    if (isVariable) return;

    const updatedAST = generateNewAST({
      type: UPDATE_TYPES.DIRECTIVE_VARIABLE,
      ast: currentAst,
      field: props.field,
      ancestorFieldNames: props.ancestorFieldNames,
      shouldAdd: !isVariable,
      fieldDirectives: props.fieldDirectives,
      directiveName,
    });

    astContext.updateAst(updatedAST);
    editorContext.queryEditor?.setValue(print(updatedAST));
    setIsVariable(!isVariable);
  };
  return (
    <>
      <Checkbox
        style={{ color: COLORS.DIRECTIVE }}
        onChange={onChange}
        value={props.directive.name}
        defaultChecked={!!props.defaultAstDirective}
      >
        {props.directive.name}
      </Checkbox>
      {isChecked && (
        <div onClick={() => onClickDirective(props.directive.name)}>$</div>
      )}
    </>
  );
}

export default FieldDirective;
