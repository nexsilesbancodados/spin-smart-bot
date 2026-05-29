import { memo } from "react";
import { useHonestStore, selectWindowSpins } from "../lib/store";
import RealWheelMap from "../components/RealWheelMap";
import WindowPicker from "../components/WindowPicker";
import { Card, PageContainer, PageHeader, EmptyState } from "../components/ui";

const MapaRoda = memo(() => {
  const spins = useHonestStore(selectWindowSpins);
  const lastSpin = useHonestStore((s) => s.spins[0]?.n);
  const totalSpins = useHonestStore((s) => s.spins.length);

  return (
    <PageContainer>
      <PageHeader
        title="Mapa da roda"
        subtitle="Sequência física europeia (sentido horário) com calor por casa na janela selecionada."
        actions={<WindowPicker />}
      />

      {totalSpins < 20 ? (
        <EmptyState
          icon="🎡"
          title={`Aguardando mais giros (${totalSpins}/20)`}
          description="O mapa fica visualmente vazio até ~50 giros — qualquer 'calor' antes disso é variância."
        />
      ) : (
        <Card>
          <RealWheelMap spins={spins} lastSpin={lastSpin} />
        </Card>
      )}
    </PageContainer>
  );
});
MapaRoda.displayName = "MapaRoda";

export default MapaRoda;
