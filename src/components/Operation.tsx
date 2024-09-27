import {
  GraphQLObjectType,
  OperationDefinitionNode,
  Kind,
  FieldNode,
} from 'graphql';
import { COLORS } from '../helpers/const';
import { Maybe } from 'graphql/jsutils/Maybe';
import RecursiveField from './RecursiveField';

type OperationProps = {
  definitionNode: OperationDefinitionNode;
  operationSchema: Maybe<GraphQLObjectType>;
};

const Operation = (props: OperationProps) => {
  // operation直下のfieldを取得
  const rootFields = Object.values(props.operationSchema?.getFields() ?? []);

  return (
    <div>
      <div style={{ color: COLORS.OPERATION }}>
        {props.definitionNode.operation}&nbsp;&nbsp;
        {props.definitionNode.name?.value}
      </div>
      {rootFields.map((field) => (
        <RecursiveField
          key={field.name}
          field={field}
          ancestorFieldNames={[props.definitionNode.name?.value ?? '']}
          defaultAstField={props.definitionNode.selectionSet.selections.find(
            (s): s is FieldNode =>
              s.kind === Kind.FIELD && s.name.value === field.name
          )}
        />
      ))}
    </div>
  );
};

export default Operation;
