import BoardLoader from '../../../ui/BoardLoader';
export default async function AdminBoardPage({params}:{params:Promise<{boardId:string}>}) { const {boardId}=await params; return <BoardLoader admin boardId={boardId}/>; }
