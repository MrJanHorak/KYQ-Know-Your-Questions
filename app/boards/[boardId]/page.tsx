import BoardLoader from '../../ui/BoardLoader';
export default async function BoardPage({params}:{params:Promise<{boardId:string}>}) { const {boardId}=await params; return <BoardLoader boardId={boardId}/>; }
