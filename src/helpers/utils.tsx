import {
  DocumentNode,
  OperationDefinitionNode,
  parse,
  Kind,
  OperationTypeNode,
  GraphQLSchema,
} from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';

// editor queryの初期値を設定
const generateNamedOperationQuery = (
  OperationType: OperationTypeNode,
  operationName: string
): string => {
  return `${OperationType} ${operationName} {
  __typename
}`;
};

// nameがnamesと重複している場合、nameの後ろに連番を付与してユニークな名前を生成する関数
const generateUniqueName = (name: string, names: string[]): string => {
  let uniqueName = name;
  let count = 0;

  while (names.includes(uniqueName)) {
    uniqueName = `${name}${++count}`;
  }

  return uniqueName;
};

// operationTypeに応じたoperationNameを生成する関数
const generateOperationName = (operationType: OperationTypeNode): string => {
  switch (operationType) {
    case OperationTypeNode.QUERY:
      return 'MyQuery';
    case OperationTypeNode.MUTATION:
      return 'MyMutation';
    case OperationTypeNode.SUBSCRIPTION:
      return 'MySubscription';
    default:
      throw new Error('Unsupported operation type');
  }
};

const createOperationDefinitionNode = (
  operationType: OperationTypeNode,
  operationName: string
): OperationDefinitionNode => {
  return {
    kind: Kind.OPERATION_DEFINITION,
    operation: operationType,
    name: {
      kind: Kind.NAME,
      value: operationName,
    },
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [
        {
          kind: Kind.FIELD,
          name: {
            kind: Kind.NAME,
            value: '__typename',
          },
        },
      ],
    },
  };
};

// queryが有効かどうかを判定する関数（無効でも例外でなくfalseを投げたい）
const isValidQuery = (query: string): boolean => {
  try {
    parse(query);
    return true;
  } catch (e) {
    return false;
  }
};

// explolerのレンダリング時、GraphiQL Editorの入力値から初期ASTを生成する
const generateAstFromInput = (input: string | undefined): DocumentNode => {
  if (!input) {
    return { kind: Kind.DOCUMENT, definitions: [] };
  }

  // 無効なqueryの場合は例外を投げるので、空のastを生成して返す
  try {
    return parse(input);
  } catch (e) {
    return { kind: Kind.DOCUMENT, definitions: [] };
  }
};

const generateDefaultAst = (queryInput: string | undefined) => {
  let defaultAst: DocumentNode = generateAstFromInput(queryInput);

  // operationDefinitionが無い場合は初期表示用にデフォルトのoperationを追加
  if (
    !defaultAst.definitions.some((d) => d.kind === Kind.OPERATION_DEFINITION)
  ) {
    const opName = generateOperationName(OperationTypeNode.QUERY);
    const opDef = createOperationDefinitionNode(
      OperationTypeNode.QUERY,
      opName
    );

    defaultAst = {
      ...defaultAst,
      definitions: [...defaultAst.definitions, opDef],
    };
  }

  return defaultAst;
};

const getMatchedOperationSchema = (
  o: OperationTypeNode,
  schema: Maybe<GraphQLSchema>
) => {
  switch (o) {
    case OperationTypeNode.QUERY:
      return schema?.getQueryType();
    case OperationTypeNode.MUTATION:
      return schema?.getMutationType();
    default:
      return schema?.getSubscriptionType();
  }
};

export {
  generateNamedOperationQuery,
  generateUniqueName,
  generateOperationName,
  isValidQuery,
  createOperationDefinitionNode,
  generateDefaultAst,
  getMatchedOperationSchema,
};
