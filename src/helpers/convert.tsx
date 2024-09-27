import {
  GraphQLInputType,
  isNamedType,
  TypeNode,
  Kind,
  isListType,
  isNonNullType,
  NamedTypeNode,
  ListTypeNode,
  GraphQLNamedInputType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  NonNullTypeNode,
} from 'graphql';

// GraphQLInputTypeからTypeNodeに変換する関数
const convertGraphQLInputTypeToTypeNode = (
  type: GraphQLInputType
): TypeNode => {
  switch (true) {
    case isListType(type):
      return convertGraphQLListToListTypeNode(type);
    case isNonNullType(type):
      return convertGraphQLNonNullToNonNullTypeNode(type);
    // namedType
    default:
      return convertGraphQLNamedInputTypeToNamedTypeNode(type);
  }
};

// GraphQLNamedInputTypeからNamedTypeNodeに変換する関数
const convertGraphQLNamedInputTypeToNamedTypeNode = (
  type: GraphQLNamedInputType
): NamedTypeNode => {
  return {
    kind: Kind.NAMED_TYPE,
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
  };
};

// GraphQLListからListTypeNodeに変換する関数
const convertGraphQLListToListTypeNode = (
  type: GraphQLList<GraphQLInputType>
): ListTypeNode => {
  return {
    kind: Kind.LIST_TYPE,
    type: convertGraphQLInputTypeToTypeNode(type.ofType),
  };
};

const convertGraphQLNonNullToNonNullTypeNode = (
  type: GraphQLNonNull<
    | GraphQLScalarType
    | GraphQLEnumType
    | GraphQLInputObjectType
    | GraphQLList<GraphQLInputType>
  >
): NonNullTypeNode => {
  return {
    kind: Kind.NON_NULL_TYPE,
    type: isNamedType(type.ofType)
      ? convertGraphQLNamedInputTypeToNamedTypeNode(type.ofType)
      : convertGraphQLListToListTypeNode(type.ofType),
  };
};

export { convertGraphQLInputTypeToTypeNode };
