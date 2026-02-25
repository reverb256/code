import { z } from "zod";
import { container } from "../../di/container.js";
import { MAIN_TOKENS } from "../../di/tokens.js";
import {
  ProcessManagerEvent,
  processEntrySchema,
} from "../../services/process-manager/schemas.js";
import type { ProcessManagerService } from "../../services/process-manager/service.js";
import { publicProcedure, router } from "../trpc.js";

const getService = () =>
  container.get<ProcessManagerService>(MAIN_TOKENS.ProcessManagerService);

export const processManagerRouter = router({
  listByTaskId: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .output(z.array(processEntrySchema))
    .query(({ input }) => getService().getProcessesForTask(input.taskId)),

  kill: publicProcedure
    .input(z.object({ processId: z.string() }))
    .mutation(({ input }) => {
      getService().killProcess(input.processId);
    }),

  getOutput: publicProcedure
    .input(z.object({ processId: z.string() }))
    .query(({ input }) => getService().getProcessOutput(input.processId)),

  clearExited: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(({ input }) => {
      getService().clearExitedProcesses(input.taskId);
    }),

  onProcessChange: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .subscription(async function* (opts) {
      const service = getService();
      const iterable = service.toIterable(ProcessManagerEvent.ProcessChanged, {
        signal: opts.signal,
      });

      for await (const event of iterable) {
        if (event.taskId === opts.input.taskId) {
          yield event;
        }
      }
    }),
});
