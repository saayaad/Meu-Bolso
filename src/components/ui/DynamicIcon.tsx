import React from 'react';
import * as LucideIcons from 'lucide-react';

interface DynamicIconProps extends LucideIcons.LucideProps {
  name: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  // @ts-expect-error Lucide contains many icon components dynamically indexed
  const IconComponent = LucideIcons[name];
  
  if (IconComponent) {
    return <IconComponent {...props} />;
  }

  // Se não for um ícone do Lucide, assume que é um emoji ou texto
  return (
    <span
      style={{
        fontSize: props.size ? props.size : '1.2em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: props.size,
        height: props.size,
        lineHeight: 1,
      }}
      className={props.className}
    >
      {name || '🏦'}
    </span>
  );
};