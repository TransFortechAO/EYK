import { UploadRecurso } from '@/components/curso/UploadRecurso';
import { ListaRecursos } from '@/components/curso/ListaRecursos';
import { useRouter } from 'next/router';

export default function EditarCurso() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Gerenciar Recursos do Curso</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Adicionar Novo Recurso</h2>
        <UploadRecurso cursoId={Number(id)} />
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Recursos do Curso</h2>
        <ListaRecursos cursoId={Number(id)} />
      </div>
    </div>
  );
}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Adicionar Novo Recurso</h2>
        <UploadRecurso cursoId={Number(id)} />
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Recursos do Curso</h2>
        <ListaRecursos cursoId={Number(id)} />
      </div>
    </div>
  );
}