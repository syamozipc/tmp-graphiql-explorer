import {
  GraphQLField,
  Kind,
  FieldNode,
  OperationDefinitionNode,
  SelectionNode,
  ArgumentNode,
  DirectiveNode,
  DocumentNode,
  isEnumType,
  GraphQLInputType,
  ObjectFieldNode,
  isListType,
  isInputObjectType,
  ValueNode,
  GraphQLDirective,
  GraphQLArgument,
  getNullableType,
  VariableDefinitionNode,
} from 'graphql';
import { convertGraphQLInputTypeToTypeNode } from './convert';
import { generateUniqueName } from './utils';
import { UPDATE_TYPES } from './const';

const getKindForFieldScalarArgument = (name: string) => {
  switch (name) {
    case 'Int':
      return Kind.INT;
    case 'Float':
      return Kind.FLOAT;
    case 'Boolean':
      return Kind.BOOLEAN;
    default:
      return Kind.STRING;
  }
};
const getDefaultValueForFieldScalarArgument = (name: string): string => {
  switch (name) {
    case 'Int':
    case 'Float':
      return '0';
    case 'Boolean':
      return 'false';
    default:
      return '';
  }
};

// TODO: 必須引数だけ作成で良いかも（その場合はisNonNullType関数で分岐する）
const createArguments = (args: Readonly<GraphQLArgument[]>) => {
  const newArgs: ArgumentNode[] = [];

  for (const arg of args) {
    newArgs.push(createArgumentRecursive(arg.type, arg.name));
  }
  return newArgs;
};

// objectTypeは再帰処理
const createArgumentRecursive = (
  type: GraphQLInputType, //arg.type,
  name: string //arg.name
): ArgumentNode => {
  // nonNullTypeは内包されている型を使用する
  const nullableType = getNullableType(type);

  switch (true) {
    case isEnumType(nullableType):
      return {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: name },
        value: {
          kind: Kind.ENUM,
          value: nullableType.getValues()[0].name,
        },
      };
    case isInputObjectType(nullableType):
      // eslint-disable-next-line no-case-declarations -- switchの外で宣言すると使用箇所と離れる為
      const objectFields: ObjectFieldNode[] = [];
      for (const field of Object.values(nullableType.getFields())) {
        objectFields.push({
          ...(createArgumentRecursive(
            field.type,
            field.name
          ) as unknown as ObjectFieldNode),
          kind: Kind.OBJECT_FIELD, // object fieldはkindがARGUMENTではなくOBJECT_FIELDなので上書き
        });
      }

      return {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: name },
        value: {
          kind: Kind.OBJECT,
          fields: [...objectFields],
        },
      };
    case isListType(nullableType):
      const defaultValue = createArgumentRecursive(
        nullableType.ofType,
        ''
      ).value;
      return {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: name },
        value: {
          kind: Kind.LIST,
          values: defaultValue ? [defaultValue] : [],
        },
      };
    // scalarTypeはdefault
    default:
      return {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: name },
        value: {
          kind: getKindForFieldScalarArgument(nullableType.name),
          value: getDefaultValueForFieldScalarArgument(nullableType.name),
        } as unknown as ValueNode,
      };
  }
};

// フィールドの選択セットを更新
const updateSelections = (
  opDeforFieldNode: OperationDefinitionNode | FieldNode,
  field: GraphQLField<any, any>,
  parentFieldName: string,
  shouldAdd: boolean
): SelectionNode[] => {
  const newSelections: SelectionNode[] = [];

  if (shouldAdd) {
    if (opDeforFieldNode.selectionSet) {
      newSelections.push(
        ...(
          opDeforFieldNode.selectionSet.selections as unknown as FieldNode[]
        ).filter(
          (s) => s.name.value !== '__typename' // __typenameはデフォルト値なので除外
        )
      );
    }

    const newField: FieldNode = {
      arguments: createArguments(field.args),
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: field.name },
    };

    newSelections.push(newField);
  } else {
    const filtered = (
      opDeforFieldNode.selectionSet?.selections as unknown as FieldNode[]
    ).filter((s) => s.name.value !== field.name);

    if (filtered.length > 0) {
      newSelections.push(...filtered);
    } else if (opDeforFieldNode.kind === Kind.OPERATION_DEFINITION) {
      // operation直下の場合はフィールドが0だとparseできずeditorに表示されないため、デフォルト値として__typenameを追加
      newSelections.push({
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: '__typename' },
      });
    }
  }

  return newSelections;
};

type updateOperationDefinitionArgs = {
  opDefNode: OperationDefinitionNode;
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  shouldAdd: boolean;
};

const updateOperationDefinition = ({
  opDefNode,
  field,
  ancestorFieldNames,
  shouldAdd,
}: updateOperationDefinitionArgs) => {
  opDefNode.selectionSet!.selections = updateSelections(
    opDefNode,
    field,
    ancestorFieldNames[0],
    shouldAdd
  );

  return opDefNode;
};

type updateFieldArgs = {
  opDefNode: OperationDefinitionNode;
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  shouldAdd: boolean;
};
const updateField = ({
  opDefNode,
  field,
  ancestorFieldNames,
  shouldAdd,
}: updateFieldArgs) => {
  const targetNode = getTargetFieldRecursive(ancestorFieldNames, 1, opDefNode);

  if (targetNode === undefined) {
    throw new Error('Target field not found');
  }

  if (!targetNode.selectionSet) {
    // @ts-ignore readonlyを無視して書き換えるため
    targetNode.selectionSet = {
      kind: Kind.SELECTION_SET,
      selections: [],
    };
  }

  targetNode.selectionSet!.selections = updateSelections(
    targetNode,
    field,
    ancestorFieldNames[ancestorFieldNames.length - 1],
    shouldAdd
  );

  return opDefNode;
};

type updateArgumentVariableArgs = {
  opDefNode: OperationDefinitionNode;
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  shouldAdd: boolean;
};
// 引数を$変数を使用する形式にする
// TODO:shouldAddがfalseで変数なし表記に戻せればベスト
const updateArgumentVariable = ({
  opDefNode,
  field,
  ancestorFieldNames,
  shouldAdd,
}: updateArgumentVariableArgs) => {
  const variableDefinitions: VariableDefinitionNode[] = [];
  const targetArgments: ArgumentNode[] = [];
  const uniqueNames = opDefNode.variableDefinitions
    ? opDefNode.variableDefinitions.map((v) => v.variable.name.value)
    : [];

  field.args.forEach((arg) => {
    // 引数名が重複しないようにuniqueNameを生成 ex) $name, $name1, $name2
    const uniqueName = generateUniqueName(arg.name, uniqueNames);
    uniqueNames.push(uniqueName);

    variableDefinitions.push({
      kind: Kind.VARIABLE_DEFINITION,
      variable: {
        kind: Kind.VARIABLE,
        name: {
          kind: Kind.NAME,
          value: uniqueName,
        },
      },
      type: convertGraphQLInputTypeToTypeNode(arg.type),
    });

    targetArgments.push({
      kind: Kind.ARGUMENT,
      name: { kind: Kind.NAME, value: arg.name },
      value: {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: uniqueName },
      },
    });
  });

  // rootでvariableDefinitionを定義
  // @ts-ignore readonlyを無視して書き換えるため
  opDefNode.variableDefinitions = [
    ...(opDefNode.variableDefinitions ? opDefNode.variableDefinitions : []),
    ...variableDefinitions,
  ];

  // 対象のfieldを取得
  const newFieldNames = [...ancestorFieldNames, field.name];
  const targetNode = getTargetFieldRecursive(newFieldNames, 1, opDefNode);

  // @ts-ignore readonlyを無視して書き換えるため
  // arguments（stringやintなど）をKind.VARIABLEに変換
  targetNode.arguments = targetArgments;

  return opDefNode;
};

type updateDirectiveArgs = {
  opDefNode: OperationDefinitionNode;
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  shouldAdd: boolean;
  fieldDirectives: GraphQLDirective[];
  directiveName: string;
};
const updateDirective = ({
  opDefNode,
  field,
  ancestorFieldNames,
  shouldAdd,
  fieldDirectives,
  directiveName,
}: updateDirectiveArgs) => {
  const newFieldNames = [...ancestorFieldNames, field.name];

  const targetNode = getTargetFieldRecursive(newFieldNames, 1, opDefNode);

  // 削除時は対象のdirectiveを削除
  if (!shouldAdd) {
    // @ts-ignore readonlyを無視して書き換えるため
    targetNode.directives = targetNode.directives?.filter(
      (d) => d.name.value !== directiveName
    );
    return opDefNode;
  }

  // directiveが見つからない場合はそのまま返す
  const targetDirective = fieldDirectives.find((d) => d.name === directiveName);
  if (!targetDirective) {
    return opDefNode;
  }

  // 追加時は対象のdirectiveを追加
  const newDirective: DirectiveNode = {
    kind: Kind.DIRECTIVE,
    loc: targetDirective.astNode?.loc,
    name: { kind: Kind.NAME, value: targetDirective.name },
    arguments: createArguments(targetDirective.args),
  };

  // @ts-ignore readonlyを無視して書き換えるため
  targetNode.directives = [
    ...(targetNode.directives ? targetNode.directives : []),
    newDirective,
  ];

  return opDefNode;
};

type updateDirectiveVariableArgs = {
  opDefNode: OperationDefinitionNode;
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  shouldAdd: boolean;
  fieldDirectives: GraphQLDirective[];
  directiveName: string;
};
const updateDirectiveVariable = ({
  opDefNode,
  field,
  ancestorFieldNames,
  shouldAdd,
  fieldDirectives,
  directiveName,
}: updateDirectiveVariableArgs) => {
  const targetDirectiveSchema = fieldDirectives.find(
    (d) => d.name === directiveName
  );
  if (!targetDirectiveSchema) {
    throw new Error('Directive not found');
  }

  const opDefVariableDefinitionNodes: VariableDefinitionNode[] = [];
  const targetFieldArgmentNodes: ArgumentNode[] = [];
  const opDefVarUniqueNames = opDefNode.variableDefinitions
    ? opDefNode.variableDefinitions.map((v) => v.variable.name.value)
    : [];

  targetDirectiveSchema.args.forEach((arg) => {
    // 引数名が重複しないようにuniqueName「ディレクティブ名 + 変数名 + increment」を生成  ex) $skipIf, $skipIf1, $skipIf2
    const uniqueName = generateUniqueName(
      targetDirectiveSchema.name +
        arg.name[0].toUpperCase() +
        arg.name.slice(1),
      opDefVarUniqueNames
    );
    opDefVarUniqueNames.push(uniqueName);

    opDefVariableDefinitionNodes.push({
      kind: Kind.VARIABLE_DEFINITION,
      variable: {
        kind: Kind.VARIABLE,
        name: {
          kind: Kind.NAME,
          value: uniqueName,
        },
      },
      type: convertGraphQLInputTypeToTypeNode(arg.type),
    });

    targetFieldArgmentNodes.push({
      kind: Kind.ARGUMENT,
      name: { kind: Kind.NAME, value: arg.name },
      value: {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: uniqueName },
      },
    });
  });

  // rootでvariableDefinitionを定義
  // @ts-ignore readonlyを無視して書き換えるため
  opDefNode.variableDefinitions = [
    ...(opDefNode.variableDefinitions ? opDefNode.variableDefinitions : []),
    ...opDefVariableDefinitionNodes,
  ];

  // 対象fieldを取得
  const targetNode = getTargetFieldRecursive(
    [...ancestorFieldNames, field.name],
    1,
    opDefNode
  );
  // 対象fieldの対象directiveを取得
  const targetDirective = targetNode.directives?.find(
    (d) => d.name.value === directiveName
  );

  if (!targetDirective) {
    throw new Error('Directive not found');
  }

  // @ts-ignore readonlyを無視して書き換えるた
  // arguments（stringやintなど）をKind.VARIABLEに変換
  targetDirective.arguments = targetFieldArgmentNodes;

  return opDefNode;
};

// operationDefinitionを開始点として操作対象のfieldを深さ優先探索し取得
const getTargetFieldRecursive = (
  ancestorFieldNames: string[],
  pointer: number,
  ast: OperationDefinitionNode | FieldNode
) => {
  const target = ast.selectionSet?.selections.find(
    (s): s is FieldNode =>
      s.kind === Kind.FIELD && s.name.value === ancestorFieldNames[pointer]
  );

  if (!target) {
    throw new Error('Target field not found');
  }

  // pointerが最後まで到達したらtargetを返す
  if (ancestorFieldNames.length === pointer + 1) {
    return target;
  }

  return getTargetFieldRecursive(ancestorFieldNames, pointer + 1, target);
};

// AST fieldの削除・追加処理
// チェックボックス押下時、親フィールドのselectionSetに選択フィールドを追加・削除することでeditorに表示させる
type GenerateNewASTArgs = {
  type: keyof typeof UPDATE_TYPES;
  ast: DocumentNode;
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  shouldAdd: boolean; // チェックボックスのチェック時、objectTypeで子要素展開時にtrue
  fieldDirectives?: GraphQLDirective[];
  directiveName?: string; // directive操作時のみ指定
};

const generateNewAST = ({
  type,
  ast,
  field,
  ancestorFieldNames,
  shouldAdd,
  fieldDirectives = [],
  directiveName,
}: GenerateNewASTArgs): DocumentNode => {
  // 何の更新かによって処理を分岐
  // 引数で渡して欲しい

  // 該当するoperationDefinitionを取得
  const opDefNode = ast.definitions.find(
    (d): d is OperationDefinitionNode =>
      d.kind === Kind.OPERATION_DEFINITION &&
      d.name?.value === ancestorFieldNames[0]
  );

  if (!opDefNode) {
    throw new Error('OperationDefinition not found');
  }

  let newOpDef: OperationDefinitionNode;

  // fieldの更新
  switch (type) {
    case UPDATE_TYPES.OPERATION_DEFINITION:
      newOpDef = updateOperationDefinition({
        opDefNode,
        field,
        ancestorFieldNames,
        shouldAdd,
      });
      break;
    case UPDATE_TYPES.FIELD:
      newOpDef = updateField({
        opDefNode,
        field,
        ancestorFieldNames,
        shouldAdd,
      });
      break;
    case UPDATE_TYPES.ARGUMENT_VARIABLE:
      newOpDef = updateArgumentVariable({
        opDefNode,
        field,
        ancestorFieldNames,
        shouldAdd,
      });
      break;
    case UPDATE_TYPES.DIRECTIVE:
      if (!directiveName) {
        throw new Error('Directive name is required');
      }
      newOpDef = updateDirective({
        opDefNode,
        field,
        ancestorFieldNames,
        shouldAdd,
        fieldDirectives: fieldDirectives,
        directiveName: directiveName,
      });
      break;
    case UPDATE_TYPES.DIRECTIVE_VARIABLE:
      if (!directiveName) {
        throw new Error('Directive name is required');
      }
      newOpDef = updateDirectiveVariable({
        opDefNode,
        field,
        ancestorFieldNames,
        shouldAdd,
        fieldDirectives: fieldDirectives,
        directiveName: directiveName,
      });
      break;
    default:
      throw new Error('Invalid type');
  }

  return ast;
};

export { generateNewAST };
