import { useState } from 'react';
import { GraphQLField, FieldNode, DirectiveLocation } from 'graphql';
import { useSchemaContext } from '@graphiql/react';
import FieldDirective from './FieldDirective';

type FieldDirectiveListProps = {
  field: GraphQLField<any, any>;
  ancestorFieldNames: string[];
  defaultAstField: FieldNode | undefined;
};

const FieldDirectiveList = (props: FieldDirectiveListProps) => {
  const schemaContext = useSchemaContext({ nonNull: true });

  // 選択済みのディレクティブがあれば展開する
  const [isDirectiveOpen, setIsDirectiveOpen] = useState(
    (props.defaultAstField?.directives?.length ?? 0 > 0) ? true : false
  );

  // フィールドに付与されるディレクティブを取得
  const fieldDirectives =
    schemaContext.schema
      ?.getDirectives()
      .filter((d) => d.locations.includes(DirectiveLocation.FIELD)) ?? [];

  return (
    <>
      <div onClick={() => setIsDirectiveOpen(!isDirectiveOpen)}>directive</div>
      {isDirectiveOpen &&
        fieldDirectives.map((d) => (
          <div key={d.name} style={{ marginLeft: 10 }}>
            <FieldDirective
              directive={d}
              field={props.field}
              fieldDirectives={fieldDirectives}
              ancestorFieldNames={props.ancestorFieldNames}
              defaultAstDirective={props.defaultAstField?.directives?.find(
                (defo) => defo.name.value === d.name
              )}
            />
          </div>
        ))}
    </>
  );
};

export default FieldDirectiveList;
