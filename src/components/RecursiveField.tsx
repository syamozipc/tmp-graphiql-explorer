import React, { useState, useContext } from 'react';
import { Checkbox } from '@chakra-ui/react';
import { useEditorContext, useSchemaContext } from '@graphiql/react';
import {
  GraphQLField,
  print,
  isObjectType,
  getNamedType,
  FieldNode,
  GraphQLArgument,
  Kind,
} from 'graphql';
import { generateNewAST } from '../helpers/ast';
import { COLORS, UPDATE_TYPES } from '../helpers/const';
import { AstContext } from '../contexts/AstContextProvider';
import FieldDirectiveList from './FieldDirectiveList';

type FieldProps = {
  ancestorFieldNames: string[];
  field: GraphQLField<any, any>;
  defaultAstField: FieldNode | undefined; // 既存のASTに存在すればそのnode、なければundefined
};

// フィールドがリーフ（objectTypeでない）に到達するまで再帰的に描画する関数
const RecursiveField = (props: FieldProps) => {
  const schemaContext = useSchemaContext({ nonNull: true });
  const editorContext = useEditorContext({ nonNull: true });
  const astContext = useContext(AstContext);

  // 子フィールドを展開するかどうかを制御
  const [isOpen, setIsOpen] = useState(!!props.defaultAstField);
  // チェックボックスの入力値に連動
  const [isChecked, setIsChecked] = useState(!!props.defaultAstField);
  // 引数の変数 <-> リテラルの切り替えを制御
  const [isArgumentVariable, setIsArgumentVariable] = useState(false);

  // nonNullTypeやlistTypeといったwrapperを外す
  const unwrappedType = getNamedType(props.field.type);
  const isObject = isObjectType(unwrappedType);

  // フィールドがobjectTypeならclickで子要素を展開
  const onClick = () => {
    // 閉じる場合は何もしない
    if (isOpen) return setIsOpen(false);
    // 一度閉じてから開く場合、既にASTに存在するので追加すると重複してしまうため何もしない
    if (props.defaultAstField) return setIsOpen(true);

    const currentAst = astContext.astRef.current;

    const updatedAST = generateNewAST({
      type:
        props.ancestorFieldNames.length === 1
          ? UPDATE_TYPES.OPERATION_DEFINITION
          : UPDATE_TYPES.FIELD,
      ast: currentAst,
      field: props.field,
      ancestorFieldNames: props.ancestorFieldNames,
      shouldAdd: !isOpen,
    });

    astContext.updateAst(updatedAST);
    editorContext.queryEditor?.setValue(print(updatedAST));
    setIsOpen(!isOpen);
  };

  // リーフの場合はcheckboxで選択したらeditorに反映
  const onChangeLeaf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentAst = astContext.astRef.current;

    const updatedAST = generateNewAST({
      type: UPDATE_TYPES.FIELD,
      ast: currentAst,
      field: props.field,
      ancestorFieldNames: props.ancestorFieldNames,
      shouldAdd: e.target.checked,
    });

    astContext.updateAst(updatedAST);
    editorContext.queryEditor?.setValue(print(updatedAST));
    setIsChecked(e.target.checked);
  };

  const onClickArgument = (arg: GraphQLArgument) => {
    // TODO: 変数とリテラルをtoggleしたい
    if (isArgumentVariable) return;

    const currentAst = astContext.astRef.current;

    const updatedAST = generateNewAST({
      type: UPDATE_TYPES.ARGUMENT_VARIABLE,
      ast: currentAst,
      field: props.field,
      ancestorFieldNames: props.ancestorFieldNames,
      shouldAdd: true,
    });

    astContext.updateAst(updatedAST);
    editorContext.queryEditor?.setValue(print(updatedAST));
    setIsArgumentVariable(true);
  };

  return (
    <div style={{ marginLeft: 10 }}>
      {/* objectの場合はclickで子要素を展開する */}
      {isObject ? (
        <div onClick={onClick} style={{ color: COLORS.OBJECT }}>
          {props.field.name}
        </div>
      ) : (
        // リーフの場合はcheckboxを描画
        <Checkbox
          onChange={onChangeLeaf}
          style={{ color: COLORS.OBJECT }}
          value={props.field.name}
          defaultChecked={isChecked}
        >
          {props.field.name}
        </Checkbox>
      )}
      {/* 「objecTypeであり子要素が表示されている or リーフでありチェックが入っている」でclickで展開可能な「directive」文言を描画 */}
      {((isObject && isOpen) || (!isObject && isChecked)) && (
        <>
          <FieldDirectiveList
            field={props.field}
            ancestorFieldNames={props.ancestorFieldNames}
            defaultAstField={props.defaultAstField}
          />
          <div style={{ marginLeft: 10 }}>
            <div>
              {/* TODO: argsもコンポーネントに分割する */}
              {props.field.args.map((arg) => (
                <div key={arg.name} onClick={() => onClickArgument(arg)}>
                  {arg.name}:$
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {isObject &&
        isOpen &&
        // フィールドがリーフに到達するまで再帰的に子要素を描画
        Object.values(unwrappedType.getFields()).map((field) => (
          <RecursiveField
            key={field.name}
            field={field}
            ancestorFieldNames={[...props.ancestorFieldNames, props.field.name]}
            defaultAstField={props.defaultAstField?.selectionSet?.selections.find(
              (s): s is FieldNode =>
                s.kind === Kind.FIELD && s.name.value === field.name
            )}
          />
        ))}
    </div>
  );
};

export default RecursiveField;
