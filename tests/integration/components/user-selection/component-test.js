import EmberObject from "@ember/object";
import { find, render } from "@ember/test-helpers";
import { setupRenderingTest } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";
import { module, test } from "qunit";
import { startMirage } from "timed/initializers/ember-cli-mirage";

const USER = EmberObject.create({
  id: 1,
  firstName: "Hans",
  lastName: "Muster",
  username: "hansm",
  longName: "Hans Muster (hansm)",
});

module("Integration | Component | user selection", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.server = startMirage();
  });

  hooks.afterEach(function () {
    this.server.shutdown();
  });

  test("renders", async function (assert) {
    assert.expect(1);
    this.set("user", USER);

    await render(hbs`
      <UserSelection @user={{this.user}} @onChange={{fn (mut user)}} as |u|>
        {{u.user}}
      </UserSelection>
    `);

    assert.strictEqual(
      find(".user-select .ember-power-select-selected-item").textContent.trim(),
      USER.longName
    );
  });
});
