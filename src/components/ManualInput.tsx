import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Shuffle } from 'lucide-react';

interface ManualInputProps {
  onAddNumber: (n: number) => void;
  onRandomNumber: () => void;
}

const ManualInput = ({ onAddNumber, onRandomNumber }: ManualInputProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(value);
    if (!isNaN(n) && n >= 0 && n <= 36) {
      onAddNumber(n);
      setValue('');
    }
  };

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <h3 className="font-display text-sm text-primary mb-3 tracking-wider uppercase">Entrada de Números</h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="number"
          min={0}
          max={36}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="0-36"
          className="bg-secondary border-border text-foreground"
        />
        <Button type="submit" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRandomNumber} className="border-border-glow-green text-primary hover:bg-primary/10">
          <Shuffle className="w-4 h-4" />
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-2">Digite o número ou gere aleatoriamente para simular</p>
    </div>
  );
};

export default ManualInput;
