// на случай, если в transaction() создастся новый автомат
var stackOfMachines = [];

class StateMachine {
	constructor(machineDescription) {
		this.state = machineDescription.initialState;
		this.id = machineDescription.id;
		this.context = machineDescription.context;
		this.states = machineDescription.states;
		this.actions = machineDescription.actions;
	}

	// onAction - либо onEntry, либо onExit, либо дейтвие при транзакции
	// actions - место, где должен быть метод onAction()
	runAction(onAction, actions=this.states[this.state], event) {
		if (onAction in actions) {
			let action = actions[onAction];
			// проверка, где находится action (в actions или же сразу объявлена функция)
			switch (typeof(action)) {
			case 'function':
				action();
				break;
			case 'string':
				this.actions[action](event);
				break;
			case 'object':
				for (let i = 0; i < action.length; i++) {
					this.actions[action[i]](event);
				}
				break;
			}
			return true;
		} else {
			return false;
		}
	}

	transition(transaction, event) {
		stackOfMachines.push(this);
		let currentState = this.state;
		let actions = this.states[currentState];
		this.runAction('onExit');
		if (this.runAction(transaction, actions.on, event)) {
			let service = actions.on[transaction].service;
			if (service !== undefined) {
				service(event)
			}
			if ('target' in actions.on[transaction]) {
				let newState = actions.on[transaction].target;
				useState()[1](newState);;
			}
		} else {
			console.log('[error] there is no transaction: ' + transaction + ' in ' + currentState + ' state')
		}
		stackOfMachines.pop();
	}
}

const machine = function(machineDescription) {
	return new StateMachine(machineDescription);
}

const useContext = function () {
	let machine = stackOfMachines[stackOfMachines.length - 1];
	return [machine.context,
		newContext => {machine.context = {...machine.context, ...newContext}}]
}

const useState = function () {
	let machine = stackOfMachines[stackOfMachines.length - 1];
	return [machine.state,
			newState => {
				machine.state = newState;
				machine.runAction('onEntry');
			}]
}



//------------------------------------------TEST------------------------------------------

const citySelectorMachine = machine({
	id: 'select',
	initialState: 'initial',
	context: {
		citySelector: document.querySelector('.modal-form_city_selector'),
		selectorList: document.querySelector('.modal-form_selector_list'),
		containerRadios: document.querySelector('.modal-form_country_radios'),
		focusElement: document.querySelector('.modal-form_selector_list'),
		suggestList: [],
		filter: ''
	},
	states: {
		initial: {
			on: {
				GETDATA: {
					service: (event) => {
						let xhr = new XMLHttpRequest();
						xhr.open('GET', event.url, true);
						xhr.send();

						const [context, setContext] = useContext();
						const [state, setState] = useState();
						stackOfMachines.push(stackOfMachines[stackOfMachines.length - 1]);

						xhr.onload = function() {
							if (xhr.status != 200) {
								alert(xhr.status + ': ' + xhr.statusText);
								stackOfMachines.pop()
							} else {
								context.data=JSON.parse(xhr.responseText);
								let newLabel;
								for (let i = 0; i < context.data.length; i++) {
									newLabel = document.createElement('label');
									newLabel.setAttribute('for', i);
									newLabel.setAttribute('style', 'width: 200px')
									newLabel.innerHTML = '<input type="radio" name="country"'
										+ 'id=' + i + ' /> ' + context.data[i].name;
									context.containerRadios.appendChild(newLabel);
								}
								let radioBtn = document.getElementById('0');
								radioBtn.setAttribute('checked', 'checked');
								setState('readyToUsage');
								stackOfMachines.pop();
							}
						};
					}
				}
			}
		},
		readyToUsage: {
			onEntry: ['formSuggestsList', 'applySuggestList'],
			on: {
				UPDATE: {
					target: 'readyToUsage'
				}
			},
			onExit() {
				const context = useContext()[0];
				let elem = context.selectorList.lastChild;
				while (elem) {
					context.selectorList.removeChild(elem);
					elem = context.selectorList.lastChild;
				} 
			}
		}
	},
	actions: {
		formSuggestsList: () => {
			const radioArr = document.getElementsByName('country');
			let i;
			for (i = 0; i < radioArr.length; i++) {
				if (radioArr[i].checked) break;
			}
			const countryChecked = i;
			const [context, setContext] = useContext();
			let suggests = [];
			context.data[countryChecked].areas.forEach(function(item, i, arr) {
				if (item.areas.length)
					for (i = 0; i < item.areas.length; i++)
						suggests.push(item.areas[i].name);
				else suggests.push(item.name);
			});
			context.suggestList = suggests;
		},
		applySuggestList: () => {
			const context = useContext()[0];
			const filter = context.filter.toUpperCase();
			let match = false;
			let sasa;
			for (let i = 0; i < context.suggestList.length; i++) {
				if (!Boolean(filter) || context.suggestList[i].toUpperCase().includes(filter)) {
					let newLi = document.createElement('li');
					newLi.setAttribute('class', 'modal-form_selector_list_el');
					newLi.setAttribute('tabindex', '-1');
					newLi.innerHTML = context.suggestList[i];
					context.selectorList.appendChild(newLi);
					match = true;
				}
			}
			if (!match) {
				let newLi = document.createElement('li');
				newLi.innerHTML = 'Нет результатов...';
				context.selectorList.appendChild(newLi);
			}
		}
	}
})

function setEventListeners() {
	const context = useContext()[0];
	const citySelector = context.citySelector;
	const selectorList = context.selectorList;
	const containerRadios = context.containerRadios;

	document.querySelector('body').addEventListener('click', () => {
		selectorList.style.display = 'none';
		const suggestList = this.context.suggestList;
		let flag = false;
		for (let i = 0; i < suggestList.length; i++) {
			if (citySelector.value == suggestList[i]) {
				flag = true;
				break;
			}
		}
		if (!flag) {
			citySelector.value = '';
		}
	});

	citySelector.addEventListener('keyup', (e) => {
		this.context.filter = citySelector.value;
		this.transition('UPDATE');
		selectorList.style.display = 'block';
		this.context.focusElement = selectorList.firstChild;
		switch(e.keyCode) {
			case 40:
				this.context.focusElement.focus();
		}
	});

	this.context.focusElement.addEventListener('keyup', (e) => {
		switch(e.keyCode) {
			case 13:
				selectorList.style.display = 'none';
				citySelector.value = this.context.focusElement.innerText;
				citySelector.focus();
				break;
			case 40:
				if (this.context.focusElement.nextSibling) {
					this.context.focusElement = this.context.focusElement.nextSibling;
					this.context.focusElement.focus();
				}
				break;
			case 38:
				if (this.context.focusElement.previousSibling) {
					this.context.focusElement = this.context.focusElement.previousSibling;
					this.context.focusElement.focus();
				} else {
					citySelector.focus();
				}
				break;
		}
	});

	containerRadios.addEventListener('change', () => {
		citySelector.value = '';
		this.context.filter = citySelector.value;
		this.transition('UPDATE');
	});

	selectorList.addEventListener('click', (e) => {
		selectorList.style.display = 'none';
		citySelector.value = e.target.innerText;
	});

	selectorList.addEventListener('mouseover', (e) => {
		this.context.focusElement = e.target;
		this.context.focusElement.focus();
	});
}

citySelectorMachine.transition('GETDATA', {url: 'https://api.hh.ru/areas'});
setEventListeners.call(citySelectorMachine);