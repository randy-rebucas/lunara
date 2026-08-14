'use client';

import { useParams } from 'next/navigation';
import { CommandCenterBoard } from '../../../../components/datacenter/command-center-board';

export default function PartnerCommandCenterPage() {
  const params = useParams();
  const id = params.id as string;
  return <CommandCenterBoard partnerId={id} />;
}
