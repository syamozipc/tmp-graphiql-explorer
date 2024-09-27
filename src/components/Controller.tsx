import { useContext, useState } from 'react';
import { useEditorContext, useSchemaContext, Button } from '@graphiql/react';
import { print, parse, Kind, OperationTypeNode, DocumentNode } from 'graphql';
import { createOperationDefinitionNode } from '../helpers/utils';
import { AstContext } from '../contexts/AstContextProvider';
import Operation from './Operation';
import {
  generateNamedOperationQuery,
  generateOperationName,
  generateUniqueName,
  generateDefaultAst,
  getMatchedOperationSchema,
  isValidQuery,
} from '../helpers/utils';

const Controller = () => {
  const [_, setChangedInput] = useState<string>();

  // GraphiQLコンポーネントに渡したschemaを取得
  const schemaContext = useSchemaContext({ nonNull: true });
  const schema = schemaContext.schema;

  // editor instance操作contextを取得
  const editorContext = useEditorContext({ nonNull: true });
  const queryInput = editorContext.queryEditor?.getValue();

  // ast操作contextを取得
  const astContext = useContext(AstContext);

  // 1つ以上のoperationがあるastを生成
  const defaultAst = generateDefaultAst(queryInput);

  // 引き回すcontextに現在のastをセット
  astContext.updateAst(defaultAst);

  // editorの入力値が変更された際にastを更新
  // changeイベントだとexplolerからの入力にも反応するため、keyupイベントを使用
  // TODO:未完成(再レンダリングしてもexplolerに反映されない
  editorContext.queryEditor?.on('keyup', () => {
    const changedInput = editorContext.queryEditor?.getValue();

    if (!isValidQuery(changedInput ?? '')) return;

    astContext.updateAst(parse(changedInput ?? ''));
    setChangedInput(changedInput ?? '');
  });

  // ボタン押下で新しいoperationを追加する関数
  const onClick = (operationType: OperationTypeNode) => {
    // editorが空もしくは無効の場合、defaultAstに1つ目のoperationをセット
    // editorが空もしくは無効の場合は最初に1つだけデフォルトでoperationを追加しているが、それはここで無くなる
    if (!queryInput || !isValidQuery(queryInput)) {
      // operationDefinitionのnameもしくはデフォルトのもの
      const operationName = generateOperationName(operationType);
      const query = generateNamedOperationQuery(operationType, operationName);

      astContext.updateAst(parse(query));
      editorContext.queryEditor?.setValue(query);

      // astContextに新しいastをセット
      // 既にoperationがある（defaultで生成したものを除き1つ目でない）場合はoperationを単に追加
    } else {
      // operationNameが重複しないようにユニークな名前を生成
      const operationName = generateOperationName(operationType);
      const uniqueName = generateUniqueName(
        operationName,
        defaultAst.definitions
          .filter((d) => d.kind === Kind.OPERATION_DEFINITION)
          .map((d) => d.name?.value ?? '')
      );

      // 新しいoperationを追加したastを生成
      const newOperation = createOperationDefinitionNode(
        operationType,
        uniqueName
      );
      const newAst: DocumentNode = {
        ...defaultAst,
        definitions: [...defaultAst.definitions, newOperation],
      };

      // astContextに新しいastをセット
      astContext.updateAst(newAst);
      editorContext.queryEditor?.setValue(print(newAst));
    }
  };

  return (
    <>
      {defaultAst.definitions
        .filter((d) => d.kind === Kind.OPERATION_DEFINITION)
        .map((d, i) => (
          <Operation
            key={`${d.operation}${i + 1}`}
            definitionNode={d}
            operationSchema={getMatchedOperationSchema(d.operation, schema)}
          />
        ))}
      <div>
        <Button onClick={() => onClick(OperationTypeNode.QUERY)}>
          Add new Query
        </Button>
        <Button onClick={() => onClick(OperationTypeNode.MUTATION)}>
          Add new Mutation
        </Button>
      </div>
    </>
  );
};

export default Controller;
