import { inject as service } from "@ember/service";
import Component from "@glimmer/component";
import { restartableTask } from "ember-concurrency";
import { trackedTask } from "ember-resources/util/ember-concurrency";
import hbs from "htmlbars-inline-precompile";

const SELECTED_TEMPLATE = hbs`{{selected.longName}}`;

const OPTION_TEMPLATE = hbs`
  <div class="{{unless option.isActive 'inactive'}}" title="{{option.longName}}{{unless option.isActive ' (inactive)'}}">
    {{option.longName}}
    {{#unless option.isActive}}
      <i class="fa fa-ban"></i>
    {{/unless}}
  </div>
`;

export default class UserSelection extends Component {
  @service tracking;
  @service store;

  selectedTemplate = SELECTED_TEMPLATE;

  optionTemplate = OPTION_TEMPLATE;

  queryOptions = null;

  users = trackedTask(this, this.fetchUsers, () => [this.queryOptions]);

  get queryOptions() {
    return this.args.queryOptions ?? null;
  }

  @restartableTask
  *fetchUsers() {
    yield this.tracking.users.perform();
    const queryOptions = this.queryOptions || {};

    queryOptions.ordering = "username";
    return yield this.store.query("user", queryOptions);
  }
}
