"""OKRunit Temporal worker. Run this to process approval gate workflows."""

import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from .activities import create_approval, get_approval, list_approvals, add_comment
from .workflows import ApprovalGateWorkflow


async def run_worker(
    temporal_address: str = "localhost:7233",
    task_queue: str = "okrunit",
    namespace: str = "default",
) -> None:
    """Start a Temporal worker that processes OKRunit approval workflows."""
    client = await Client.connect(temporal_address, namespace=namespace)

    worker = Worker(
        client,
        task_queue=task_queue,
        workflows=[ApprovalGateWorkflow],
        activities=[create_approval, get_approval, list_approvals, add_comment],
    )

    print(f"OKRunit worker started on task queue '{task_queue}'")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
