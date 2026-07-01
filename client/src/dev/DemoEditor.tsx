import { ChordEditor } from '../components/ChordEditor';

const SAMPLE = `{title: Treu}
{artist: Tobias Gerster}
{key: E}

{comment: Vers}
Du [E]bleibst an meiner Seite   du [F#m7]schämst dich nicht für mich
Du [A]weißt ich bin untreu   und [B]dennoch gehst du nicht

{comment: Chorus}
Du bist [E]treu Herr   an [A]jedem neuen Tag
Du bist [E]treu Herr   [F#m7]auch wenn ich ver – [B]sag`;

/** NUR Entwicklung (?demo=editor): zeigt den ChordPro-Editor mit einem Beispiel-Lied, um Toolbar,
 *  Syntax-Farben, Rückgängig/Wiederholen und die PDF-Vorschau ohne ChurchTools zu prüfen. */
export function DemoEditor() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <ChordEditor
        songTitle="Treu"
        initialText={SAMPLE}
        initialName="Akustik"
        isNew={false}
        saving={false}
        error={null}
        onSave={(text, name) => console.log('save', name, text.length)}
        onDelete={() => console.log('delete')}
        onClose={() => console.log('close')}
      />
    </div>
  );
}
