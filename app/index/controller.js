/**
 * @module timed
 * @submodule timed-controllers
 * @public
 */
import Controller from "@ember/controller";
import { action, computed } from "@ember/object";
import { reads } from "@ember/object/computed";
import { scheduleOnce } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { camelize } from "@ember/string";
import { tracked } from "@glimmer/tracking";
import Ember from "ember";
import { dropTask, restartableTask, timeout } from "ember-concurrency";
import moment from "moment";
import { tracked as trackedWrapper } from "tracked-built-ins";
import { cached } from "tracked-toolbox";

import AbsenceValidations from "timed/validations/absence";
import MultipleAbsenceValidations from "timed/validations/multiple-absence";

/**
 * The index controller
 *
 * @class IndexController
 * @extends Ember.Controller
 * @public
 */
export default class IndexController extends Controller {
  queryParams = ["day"];

  @trackedWrapper day = moment().format("YYYY-MM-DD");
  @trackedWrapper center;
  @tracked showAddModal = false;
  @tracked showEditModal = false;
  @trackedWrapper disabledDates = [];

  @service session;
  @service notify;

  constructor(...args) {
    super(...args);

    this._activeActivityDuration = moment.duration();
  }

  AbsenceValidations = AbsenceValidations;
  MultipleAbsenceValidations = MultipleAbsenceValidations;

  get _allActivities() {
    return this.store.peekAll("activity");
  }

  get _activities() {
    const activitiesThen = this.get("_allActivities").filter((a) => {
      return (
        a.get("date") &&
        a.get("date").isSame(this.date, "day") &&
        a.get("user.id") === this.get("user.id") &&
        !a.get("isDeleted")
      );
    });

    if (activitiesThen.get("length")) {
      scheduleOnce("afterRender", this, this.get("_activitySumTask").perform);
    }

    return activitiesThen;
  }

  /**
   * The duration sum of all activities of the selected day
   *
   * @property {moment.duration} activitySum
   * @public
   */
  get activitySum() {
    this._activitySum();

    return this._activities.rejectBy("active").reduce((total, current) => {
      return total.add(current.get("duration"));
    }, this._activeActivityDuration);
  }

  /**
   * Compute the current activity sum
   *
   * @method _activitySum
   * @private
   */
  _activitySum() {
    return this._activities.filterBy("active").reduce((total, current) => {
      return total.add(moment().diff(current.get("from")));
    }, moment.duration());

    this._activeActivityDuration = duration;
  }

  /**
   * Run _activitySum every second.
   *
   * @method _activitySumTask
   * @private
   */
  @dropTask
  *_activitySumTask() {
    while (true) {
      this._activitySum();

      /* istanbul ignore else */
      if (Ember.testing) {
        return;
      }

      /* istanbul ignore next */
      yield timeout(1000);
    }
  }

  /**
   * All attendances
   *
   * @property {Attendance[]} _allAttendances
   * @private
   */
  get _allAttendances() {
    return this.store.peekAll("attendance");
  }

  /**
   * All attendances filtered by the selected day and the current user
   *
   * @property {Attendance[]} _attendances
   * @private
   */
  get _attendances() {
    return this._allAttendances.filter((attendance) => {
      return (
        attendance.get("date") &&
        attendance.get("date").isSame(this.date, "day") &&
        attendance.get("user.id") === this.get("user.id") &&
        !attendance.get("isDeleted")
      );
    });
  }

  /**
   * The duration sum of all attendances of the selected day
   *
   * @property {moment.duration} attendanceSum
   * @public
   */
  get attendanceSum() {
    return this._attendances.reduce((total, current) => {
      return total.add(current.duration);
    }, moment.duration());
  }

  /**
   * All reports
   *
   * @property {Report[]} _allReports
   * @private
   */
  get _allReports() {
    return this.store.peekAll("report");
  }

  /**
   * All absences
   *
   * @property {Absence[]} _allAbsences
   * @private
   */
  get _allAbsences() {
    return this.store.peekAll("absence");
  }

  /**
   * All reports filtered by the selected day and the current user
   *
   * @property {Report[]} _reports
   * @private
   */
  get _reports() {
    return this._allReports.filter((report) => {
      return (
        report.date.isSame(this.date, "day") &&
        report.get("user.id") === this.get("user.id") &&
        !report.isNew &&
        !report.isDeleted
      );
    });
  }

  /**
   * All absences filtered by the selected day and the current user
   *
   * @property {Absence[]} _absences
   * @private
   */
  get _absences() {
    return this._allAbsences.filter((absence) => {
      return (
        absence.date.isSame(this.date, "day") &&
        absence.get("user.id") === this.get("user.id") &&
        !absence.isNew &&
        !absence.isDeleted
      );
    });
  }

  /**
   * The duration sum of all reports of the selected day
   *
   * @property {moment.duration} reportSum
   * @public
   */
  get reportSum() {
    const reportDurations = this._reports.mapBy("duration");
    const absenceDurations = this._absences.mapBy("duration");

    return [...reportDurations, ...absenceDurations].reduce(
      (val, dur) => val.add(dur),
      moment.duration()
    );
  }

  /**
   * The absence of the current day if available
   *
   * This should always be the first of all absences of the day because in
   * theory, we can only have one absence per day.
   *
   * @property {Absence} absence
   * @public
   */
  get absence() {
    return this._absences?.firstObject ?? null;
  }

  /**
   * All absence types
   *
   * @property {AbsenceType[]} absenceTypes
   * @public
   */
  get absenceTypes() {
    return this.store.peekAll("absence-type");
  }

  /**
   * The currently selected day as a moment object
   *
   * @property {moment} date
   * @public
   */
  @cached
  get date() {
    return moment(this.day, "YYYY-MM-DD");
  }

  set date(value) {
    this.day = value.format("YYYY-MM-DD");
  }

  /**
   * The expected worktime of the user
   *
   * @property {moment.duration} expectedWorktime
   * @public
   */
  @reads("user.activeEmployment.worktimePerDay") expectedWorktime;

  /**
   * The workdays for the location related to the users active employment
   *
   * @property {Number[]} workdays
   * @public
   */
  @reads("user.activeEmployment.location.workdays") workdays;

  /**
   * The data for the weekly overview
   *
   * @property {Object[]} weeklyOverviewData
   * @public
   */
  get weeklyOverviewData() {
    const task = this._weeklyOverviewData;

    task.perform(
      this._allReports,
      this._allAbsences,
      this.date,
      this.get("user")
    );

    return task;
  }

  /**
   * The task to compute the data for the weekly overview
   *
   * @property {EmberConcurrency.Task} _weeklyOverviewData
   * @private
   */
  @restartableTask
  *_weeklyOverviewData(allReports, allAbsences, date, user) {
    yield timeout(200);

    allReports = allReports.filter(
      (report) =>
        report.get("user.id") === user.get("id") &&
        !report.get("isDeleted") &&
        !report.get("isNew")
    );

    allAbsences = allAbsences.filter(
      (absence) =>
        absence.get("user.id") === user.get("id") &&
        !absence.get("isDeleted") &&
        !absence.get("isNew")
    );

    const allHolidays = this.store.peekAll("public-holiday");

    // Build an object containing reports, absences and holidays
    // {
    //  '2017-03-21': {
    //    reports: [report1, report2, ...],
    //    absences: [absence1, ...],
    //    publicHolidays: [publicHoliday1, ...]
    //  }
    //  ...
    // }
    const container = [
      ...allReports.toArray(),
      ...allAbsences.toArray(),
      ...allHolidays.toArray(),
    ].reduce((obj, model) => {
      const d = model.get("date").format("YYYY-MM-DD");

      obj[d] = obj[d] || { reports: [], absences: [], publicHolidays: [] };

      obj[d][`${camelize(model.constructor.modelName)}s`].push(model);

      return obj;
    }, {});

    return Array.from({ length: 31 }, (value, index) =>
      moment(date).add(index - 20, "days")
    ).map((d) => {
      const {
        reports = [],
        absences = [],
        publicHolidays = [],
      } = container[d.format("YYYY-MM-DD")] || {};

      let prefix = "";

      if (publicHolidays.length) {
        prefix = publicHolidays.get("firstObject.name");
      } else if (absences.length) {
        prefix = absences.get("firstObject.absenceType.name");
      }

      return {
        day: d,
        active: d.isSame(date, "day"),
        absence: !!absences.length,
        workday: this.get("workdays").includes(d.isoWeekday()),
        worktime: [
          ...reports.mapBy("duration"),
          ...absences.mapBy("duration"),
        ].reduce((val, dur) => val.add(dur), moment.duration()),
        holiday: !!publicHolidays.length,
        prefix,
      };
    });
  }

  /**
   * Set a new center for the calendar and load all disabled dates
   *
   * @method setCenter
   * @param {Object} value The value to set center to
   * @param {moment} value.moment The moment version of the value
   * @param {Date} value.date The date version of the value
   * @public
   */
  @dropTask
  *setCenter({ moment: center }) {
    yield Promise.resolve();

    const from = moment(center)
      .startOf("month")
      .startOf("week")
      .startOf("day")
      .add(1, "days");
    const to = moment(center)
      .endOf("month")
      .endOf("week")
      .endOf("day")
      .add(1, "days");

    /* eslint-disable camelcase */
    const params = {
      from_date: from.format("YYYY-MM-DD"),
      to_date: to.format("YYYY-MM-DD"),
      user: this.get("user.id"),
    };
    /* eslint-enable camelcase */

    const absences = yield this.store.query("absence", params);

    const publicHolidays = yield this.store.query("public-holiday", {
      ...params,
      location: this.get("user.activeEmployment.location.id"),
    });

    const disabled = [
      ...absences.mapBy("date"),
      ...publicHolidays.mapBy("date"),
    ];
    const date = moment(from);
    const workdays = this.get("workdays");

    while (date < to) {
      if (!workdays.includes(date.isoWeekday())) {
        disabled.push(moment(date));
      }
      date.add(1, "days");
    }

    this.disabledDates = disabled;
    this.center = center;
  }

  /**
   * The disabled dates without the current date
   *
   * @property {moment[]} disabledDatesForEdit
   * @public
   */
  get disabledDatesForEdit() {
    return this.disabledDates.filter(
      (date) => !date.isSame(this.absence.date, "day")
    );
  }

  /**
   * Rollback the changes made in the absence dialogs
   *
   * @method rollback
   * @param {EmberChangeset.Changeset} changeset The changeset to rollback
   * @public
   */
  @action
  rollback(changeset) {
    this.setCenter.perform({ moment: this.date });

    changeset.rollback();
  }

  @action
  updateSelection(changeset, key, value, ...args) {
    changeset.set(key, value.moment);
    // prevent pointer event from bubbling
    args.lastObject?.preventDefault();
  }

  /**
   * Edit an existing absence
   *
   * @method editAbsence
   * @param {EmberChangeset.Changeset} changeset The changeset containing the absence data
   * @public
   */
  @action
  async saveAbsence(changeset) {
    try {
      this.send("loading");

      await changeset.save();

      this.showEditModal = false;
    } catch (e) {
      /* istanbul ignore next */
      this.get("notify").error("Error while saving the absence");
    } finally {
      this.send("finished");
    }
  }

  /**
   * Delete an absence
   *
   * @method deleteAbsence
   * @param {Absence} absence The absence to delete
   * @public
   */
  @action
  async deleteAbsence(absence) {
    try {
      this.send("loading");

      await absence.destroyRecord();
      
      this.showEditModal = false;
    } catch (e) {
      /* istanbul ignore next */
      this.get("notify").error("Error while deleting the absence");
    } finally {
      this.send("finished");
    }
  }

  /**
   * Add one or more absences
   *
   * @method addAbsence
   * @param {EmberChangeset.Changeset} changeset The changeset containing the absence data
   * @public
   */
  @action
  async addAbsence(changeset) {
    try {
      const absenceType = changeset.get("absenceType");
      const comment = changeset.get("comment");
      const dates = changeset.get("dates");
      for (const date of dates) {
        const absence = this.store.createRecord("absence", {
          absenceType,
          date,
          comment,
        });

        await absence.save();
      }

      changeset.rollback();

      this.showAddModal = false;
    } catch (e) {
      /* istanbul ignore next */
      this.get("notify").error("Error while adding the absence");
    } finally {
      this.send("finished");
    }
  }
}
