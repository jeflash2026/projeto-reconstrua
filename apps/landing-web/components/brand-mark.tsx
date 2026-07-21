type BrandMarkProps = {
  compact?: boolean;
  light?: boolean;
};

export function BrandMark({ compact = false, light = true }: BrandMarkProps) {
  const color = light ? '#ffffff' : '#050505';

  return (
    <span className="brand-mark" aria-label="Projeto Reconstrua">
      <svg aria-hidden="true" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M7 35.5V6.5H20.4C28.2 6.5 33 10.7 33 17.6C33 22.6 30.4 26.1 25.8 27.9L34.5 35.5H25.1L17.3 28.7H15.3V35.5H7ZM15.3 21.7H19.3C22.5 21.7 24.6 20.2 24.6 17.5C24.6 14.8 22.5 13.4 19.3 13.4H15.3V21.7Z"
          fill={color}
        />
        <path d="M6 6H35.5" stroke="#C1121F" strokeWidth="2.2" />
      </svg>
      {!compact && (
        <span className="brand-wordmark">
          <span>PROJETO</span>
          <strong>RECONSTRUA</strong>
        </span>
      )}
    </span>
  );
}
