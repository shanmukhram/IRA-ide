/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
// (storage service comes from DI via IraApprovalsService)
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { ChatViewContainerId } from '../../chat/browser/chat.js';
import { IraApprovalsService } from './iraApprovals.js';
import { IraApprovalsView } from './iraApprovalsView.js';

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
const chatContainer = viewContainersRegistry.get(ChatViewContainerId);

if (chatContainer) {
	viewsRegistry.registerViews([
		{
			id: IraApprovalsView.ID,
			name: IraApprovalsView.TITLE,
			ctorDescriptor: new SyncDescriptor(IraApprovalsView),
			canToggleVisibility: true,
			canMoveView: true,
			weight: 80,
			order: 2,
		}
	], chatContainer);
}

registerAction2(class IraRequestApprovalAction extends Action2 {
	constructor() {
		super({
			id: 'ira.approvals.request',
			title: localize2('ira.requestApproval', 'IRA: Request Approval'),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const quickInputService = accessor.get(IQuickInputService) as IQuickInputService;
		const instantiationService = accessor.get(IInstantiationService) as IInstantiationService;
		const approvals = instantiationService.createInstance(IraApprovalsService);

		void (async () => {
			const title = await quickInputService.input({ prompt: 'Approval title', placeHolder: 'e.g. Push to main, run build, edit config…' });
			if (!title) {
				return;
			}
			const details = await quickInputService.input({ prompt: 'Details (optional)' });
			approvals.add(title, details);
		})();
	}
});

registerAction2(class IraApproveApprovalAction extends Action2 {
	constructor() {
		super({
			id: 'ira.approvals.approve',
			title: localize2('ira.approveApproval', 'IRA: Approve'),
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, id: unknown): void {
		const instantiationService = accessor.get(IInstantiationService) as IInstantiationService;
		const approvals = instantiationService.createInstance(IraApprovalsService);
		if (typeof id === 'string') {
			approvals.updateStatus(id, 'approved');
		}
	}
});

registerAction2(class IraRejectApprovalAction extends Action2 {
	constructor() {
		super({
			id: 'ira.approvals.reject',
			title: localize2('ira.rejectApproval', 'IRA: Reject'),
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, id: unknown): void {
		const instantiationService = accessor.get(IInstantiationService) as IInstantiationService;
		const approvals = instantiationService.createInstance(IraApprovalsService);
		if (typeof id === 'string') {
			approvals.updateStatus(id, 'rejected');
		}
	}
});

registerAction2(class IraClearApprovalsAction extends Action2 {
	constructor() {
		super({
			id: 'ira.approvals.clear',
			title: localize2('ira.clearApprovals', 'IRA: Clear Approvals'),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const instantiationService = accessor.get(IInstantiationService) as IInstantiationService;
		const approvals = instantiationService.createInstance(IraApprovalsService);
		approvals.clear();
	}
});
