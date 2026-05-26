import { RichTextField } from '@jamarq/cpanel-admin-kit/rich-text';

export default function RichTextEditor({ value = '', onChange }) {
  return (
    <RichTextField
      value={value}
      onChange={onChange}
      minHeight="180px"
      placeholder="Write the public copy here..."
    />
  );
}
